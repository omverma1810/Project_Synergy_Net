from celery import shared_task
from django.utils import timezone
from .models import Analysis, AnalysisResult
from .engine import IncentiveEngine
from territories.models import Territory


@shared_task
def run_analysis(analysis_id):
    analysis = Analysis.objects.get(id=analysis_id)
    try:
        analysis.status = Analysis.Status.RUNNING
        analysis.started_at = timezone.now()
        analysis.save(update_fields=['status', 'started_at'])

        engine = IncentiveEngine(analysis.budget)
        territories = Territory.objects.filter(status=Territory.Status.ACTIVE)
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
