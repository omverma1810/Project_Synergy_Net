from decimal import Decimal
from celery import shared_task
from django.utils import timezone
from .models import Analysis, AnalysisResult
from .engine import IncentiveEngine
from territories.models import Territory


def _ensure_budget_has_line_items(budget):
    """Synthesize BudgetLineItems from project.spend_estimates if budget has none."""
    if budget.line_items.exists():
        return
    project = budget.project
    estimates = project.spend_estimates or {}
    if not estimates:
        return
    from projects.models import BudgetLineItem
    items = []
    for idx, (category, amount) in enumerate(estimates.items()):
        items.append(BudgetLineItem(
            budget=budget,
            description=category,
            category=category,
            amount=Decimal(str(amount)),
            currency=project.currency,
            is_local_eligible=True,
            sort_order=idx,
        ))
    if items:
        BudgetLineItem.objects.bulk_create(items)


@shared_task
def run_analysis(analysis_id):
    analysis = Analysis.objects.select_related('budget__project').get(id=analysis_id)
    try:
        analysis.status = Analysis.Status.RUNNING
        analysis.started_at = timezone.now()
        analysis.save(update_fields=['status', 'started_at'])

        _ensure_budget_has_line_items(analysis.budget)

        engine = IncentiveEngine(analysis.budget)
        territories = Territory.objects.filter(status=Territory.Status.ACTIVE).prefetch_related(
            'spend_mappings', 'rules', 'compliance_items', 'genre_profiles'
        )
        ranked_results = engine.rank_territories(territories)

        results_to_create = [
            AnalysisResult(
                analysis=analysis,
                territory=result['territory'],
                rank=result['rank'],
                qualified_spend_total=result['qualified_spend_total'],
                estimated_rebate=result['estimated_rebate'],
                estimated_rebate_pct=result['estimated_rebate_pct'],
                logistics_premium=result['logistics_premium'],
                net_benefit=result['net_benefit'],
                payback_timeline_months=result['payback_timeline_months'],
                confidence_score=result['confidence_score'],
                currency=result['currency'],
                rebate_timing_months=result['rebate_timing_months'],
                loan_against_rebate_available=result['loan_against_rebate_available'],
                financing_benefit_estimate=result['financing_benefit_estimate'],
                recoupment_priority=result['recoupment_priority'],
                details=result['details'],
            )
            for result in ranked_results
        ]
        AnalysisResult.objects.bulk_create(results_to_create)

        analysis.status = Analysis.Status.COMPLETE
        analysis.completed_at = timezone.now()
        analysis.save(update_fields=['status', 'completed_at'])

        analysis.project.status = 'REVIEW'
        analysis.project.save(update_fields=['status'])

    except Exception as e:
        analysis.status = Analysis.Status.FAILED
        analysis.save(update_fields=['status'])
        raise
