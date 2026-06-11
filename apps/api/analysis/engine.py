from decimal import Decimal
from django.db.models import Sum
from territories.models import Territory, QualifiedSpendMapping, TerritoryRule, GenreIntelligenceProfile
from projects.models import BudgetLineItem


LOGISTICS_MULTIPLIERS = {
    'SA': Decimal('0.15'),
    'BE': Decimal('0.08'),
    'RO': Decimal('0.05'),
    'GB': Decimal('0.10'),
    'GB_HETV': Decimal('0.10'),
    'MA': Decimal('0.06'),
    'IE': Decimal('0.07'),
    'HU': Decimal('0.08'),
    'RS': Decimal('0.09'),
    'AU': Decimal('0.12'),
    'AU_PDV': Decimal('0.11'),
    'AE': Decimal('0.14'),
    'CA': Decimal('0.09'),
    'CA_BC': Decimal('0.09'),
    'ES_CI': Decimal('0.10'),
    'PL': Decimal('0.07'),
}

DISCOUNT_RATE = Decimal('0.12')


class IncentiveEngine:
    def __init__(self, budget):
        self.budget = budget
        self.line_items = list(budget.line_items.all())
        self.total_budget = budget.line_items.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        self.project = budget.project

    def _get_genre_bonus(self, territory):
        genre = (self.project.genre or '').lower()
        if not genre:
            return Decimal('0')
        try:
            profile = GenreIntelligenceProfile.objects.get(territory=territory, genre=genre)
            return profile.bonus_percentage
        except GenreIntelligenceProfile.DoesNotExist:
            return Decimal('0')

    def _get_stacked_percentage(self, territory):
        base = territory.base_percentage
        if territory.is_stackable and territory.provincial_percentage > 0:
            base += territory.provincial_percentage
        genre_bonus = self._get_genre_bonus(territory)
        return base + genre_bonus

    def _get_treaty_bonus(self, territory):
        rules = TerritoryRule.objects.filter(
            territory=territory,
            rule_type=TerritoryRule.RuleType.TREATY_BONUS,
            is_active=True,
        )
        bonus = Decimal('0')
        for rule in rules:
            bonus += Decimal(str(rule.configuration.get('bonus_pct', 0)))
        return bonus

    def _compute_financing_benefit(self, rebate, territory):
        timing = Decimal(str(
            (territory.rebate_timing_months_min + territory.rebate_timing_months_max) / 2
        ))
        pv = rebate / (1 + DISCOUNT_RATE * timing / Decimal('12'))
        return pv.quantize(Decimal('0.01'))

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

        effective_pct = self._get_stacked_percentage(territory)
        treaty_bonus = self._get_treaty_bonus(territory)
        effective_pct += treaty_bonus

        rebate = qualified_total * (effective_pct / Decimal('100'))

        if territory.is_capped and territory.max_rebate_cap and rebate > territory.max_rebate_cap:
            rebate = territory.max_rebate_cap

        multiplier = LOGISTICS_MULTIPLIERS.get(territory.country_code, Decimal('0.10'))
        logistics_premium = self.total_budget * multiplier
        net_benefit = rebate - logistics_premium

        timing_midpoint = int(
            (territory.rebate_timing_months_min + territory.rebate_timing_months_max) / 2
        )
        financing_benefit = self._compute_financing_benefit(rebate, territory)

        confidence = Decimal('0.85') if mappings else Decimal('0.60')
        if treaty_bonus > 0:
            confidence = min(confidence + Decimal('0.05'), Decimal('0.95'))

        # Compliance checklist for this territory
        checklist = list(territory.compliance_items.values(
            'item_type', 'description', 'deadline_type', 'is_mandatory', 'notes'
        ))

        return {
            'territory': territory,
            'qualified_spend_total': qualified_total,
            'estimated_rebate': rebate,
            'estimated_rebate_pct': effective_pct,
            'logistics_premium': logistics_premium,
            'net_benefit': net_benefit,
            'payback_timeline_months': timing_midpoint,
            'confidence_score': confidence,
            'currency': territory.currency,
            'rebate_timing_months': timing_midpoint,
            'loan_against_rebate_available': territory.loan_against_rebate_available,
            'financing_benefit_estimate': financing_benefit,
            'recoupment_priority': 'shared',
            'details': {
                'category_breakdown': {
                    k: {'qualified': float(v['qualified']), 'total': float(v['total'])}
                    for k, v in category_breakdown.items()
                },
                'rules_applied': ['min_spend_check', 'qualified_spend_mapping', 'cap_application', 'stacking', 'genre_bonus'],
                'total_budget': float(self.total_budget),
                'base_percentage': float(territory.base_percentage),
                'provincial_percentage': float(territory.provincial_percentage),
                'genre_bonus': float(self._get_genre_bonus(territory)),
                'treaty_bonus': float(treaty_bonus),
                'effective_percentage': float(effective_pct),
                'checklist_items': checklist,
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
