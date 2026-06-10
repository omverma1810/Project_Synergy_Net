from decimal import Decimal
from django.db.models import Sum
from territories.models import Territory, QualifiedSpendMapping
from projects.models import BudgetLineItem


class IncentiveEngine:
    def __init__(self, budget):
        self.budget = budget
        self.line_items = list(budget.line_items.all())
        self.total_budget = budget.line_items.aggregate(total=Sum('amount'))['total'] or Decimal('0')

    def analyze_territory(self, territory):
        if territory.min_spend and self.total_budget < territory.min_spend:
            return None

        qualified_total = Decimal('0')
        category_breakdown = {}

        mappings = list(QualifiedSpendMapping.objects.filter(territory=territory, is_active=True))

        for item in self.line_items:
            matched = False
            for mapping in mappings:
                pattern = mapping.budget_category_pattern.lower()
                if pattern in item.description.lower() or pattern in (item.category or '').lower():
                    eligible_amount = item.amount * (mapping.eligibility_percentage / Decimal('100'))
                    qualified_total += eligible_amount

                    cat = mapping.mapped_eligible_category
                    if cat not in category_breakdown:
                        category_breakdown[cat] = {'qualified': Decimal('0'), 'total': Decimal('0')}
                    category_breakdown[cat]['qualified'] += eligible_amount
                    category_breakdown[cat]['total'] += item.amount
                    matched = True
                    break

            if not matched and item.is_local_eligible:
                qualified_total += item.amount

        rebate = qualified_total * (territory.base_percentage / Decimal('100'))

        if territory.is_capped and territory.max_rebate_cap and rebate > territory.max_rebate_cap:
            rebate = territory.max_rebate_cap

        logistics_multipliers = {
            'SA': Decimal('0.15'),
            'BE': Decimal('0.08'),
            'RO': Decimal('0.05'),
            'GB': Decimal('0.10'),
            'MA': Decimal('0.06'),
        }
        multiplier = logistics_multipliers.get(territory.country_code, Decimal('0.10'))
        logistics_premium = self.total_budget * multiplier

        net_benefit = rebate - logistics_premium

        confidence = Decimal('0.85') if mappings else Decimal('0.60')

        return {
            'territory': territory,
            'qualified_spend_total': qualified_total,
            'estimated_rebate': rebate,
            'estimated_rebate_pct': territory.base_percentage,
            'logistics_premium': logistics_premium,
            'net_benefit': net_benefit,
            'payback_timeline_months': 12,
            'confidence_score': confidence,
            'currency': territory.currency,
            'details': {
                'category_breakdown': {
                    k: {'qualified': float(v['qualified']), 'total': float(v['total'])}
                    for k, v in category_breakdown.items()
                },
                'rules_applied': ['min_spend_check', 'qualified_spend_mapping', 'cap_application'],
                'total_budget': float(self.total_budget),
            },
        }

    def rank_territories(self, territories):
        results = []
        for territory in territories:
            result = self.analyze_territory(territory)
            if result:
                results.append(result)

        results.sort(key=lambda x: x['net_benefit'], reverse=True)

        for idx, result in enumerate(results):
            result['rank'] = idx + 1

        return results
