from django.core.management.base import BaseCommand
from territories.models import Territory, TerritoryRule, QualifiedSpendMapping


TERRITORIES = [
    {
        'name': 'Saudi Arabia',
        'country_code': 'SA',
        'region': 'Middle East',
        'incentive_type': 'CASH_REBATE',
        'base_percentage': 60.00,
        'min_spend': 200000.00,
        'max_rebate_cap': None,
        'currency': 'SAR',
        'is_capped': False,
        'is_stackable': False,
        'description': '60% uncapped cash rebate for foreign productions. Minimum spend $200K for features, $50K for docs.',
        'official_url': 'https://www.saudifilmcommission.gov.sa',
        'rules': [
            {
                'rule_type': 'MIN_SPEND',
                'configuration': {'amount': 200000, 'currency': 'USD', 'category': 'features'},
                'priority': 1,
            },
            {
                'rule_type': 'MIN_SPEND',
                'configuration': {'amount': 50000, 'currency': 'USD', 'category': 'documentaries'},
                'priority': 2,
            },
            {
                'rule_type': 'LOCAL_SPEND',
                'configuration': {'min_percentage': 75, 'description': 'Majority of spend must be in-country'},
                'priority': 3,
            },
        ],
    },
    {
        'name': 'Belgium',
        'country_code': 'BE',
        'region': 'Europe',
        'incentive_type': 'TAX_SHELTER',
        'base_percentage': 66.00,
        'min_spend': 250000.00,
        'max_rebate_cap': None,
        'currency': 'EUR',
        'is_capped': False,
        'is_stackable': True,
        'description': 'Up to 66% stacked: Tax Shelter (up to 42%) + regional funds (Screen Flanders, Screen Brussels, Wallimage up to 24%).',
        'official_url': 'https://www.screenflanders.be',
        'rules': [
            {
                'rule_type': 'STACKING',
                'configuration': {
                    'components': [
                        {'name': 'Tax Shelter', 'max_percentage': 42},
                        {'name': 'Screen Flanders', 'max_percentage': 12},
                        {'name': 'Screen Brussels', 'max_percentage': 12},
                        {'name': 'Wallimage', 'max_percentage': 12},
                    ],
                    'max_total': 66,
                },
                'priority': 1,
            },
            {
                'rule_type': 'ELIGIBLE_CATEGORY',
                'configuration': {'types': ['feature_film', 'animation', 'documentary', 'tv_series']},
                'priority': 2,
            },
        ],
    },
    {
        'name': 'Romania',
        'country_code': 'RO',
        'region': 'Europe',
        'incentive_type': 'CASH_REBATE',
        'base_percentage': 30.00,
        'min_spend': 100000.00,
        'max_rebate_cap': 10000000.00,
        'currency': 'EUR',
        'is_capped': True,
        'is_stackable': False,
        'description': '30% cash rebate via Ofic.ro state aid program. Max €10M cap. Minimum spend requirements apply.',
        'official_url': 'https://ofic.ro',
        'rules': [
            {
                'rule_type': 'MIN_SPEND',
                'configuration': {'amount': 100000, 'currency': 'EUR'},
                'priority': 1,
            },
            {
                'rule_type': 'LOCAL_SPEND',
                'configuration': {'min_percentage': 30, 'description': 'Minimum 30% of budget must be Romanian spend'},
                'priority': 2,
            },
            {
                'rule_type': 'CREW_REQUIREMENT',
                'configuration': {'min_local_crew_percentage': 20, 'description': 'Minimum 20% local crew'},
                'priority': 3,
            },
        ],
    },
    {
        'name': 'United Kingdom',
        'country_code': 'GB',
        'region': 'Europe',
        'incentive_type': 'TAX_CREDIT',
        'base_percentage': 34.00,
        'min_spend': None,
        'max_rebate_cap': None,
        'currency': 'GBP',
        'is_capped': False,
        'is_stackable': False,
        'description': 'AVEC: 34% film/HETV, 39% animation, 53% films under £15M. Cultural test required.',
        'official_url': 'https://www.bfi.org.uk',
        'rules': [
            {
                'rule_type': 'CULTURAL_TEST',
                'configuration': {
                    'min_points': 18,
                    'total_points': 35,
                    'description': 'BFI Cultural Test — must score at least 18/35 points',
                },
                'priority': 1,
            },
            {
                'rule_type': 'ELIGIBLE_CATEGORY',
                'configuration': {
                    'types': ['film', 'high_end_tv', 'animation', 'children_tv'],
                    'enhanced_rates': {
                        'animation': 39,
                        'film_under_15m_gbp': 53,
                    },
                },
                'priority': 2,
            },
            {
                'rule_type': 'LOCAL_SPEND',
                'configuration': {'min_percentage': 10, 'description': 'Minimum 10% of budget as UK spend (no minimum threshold for film)'},
                'priority': 3,
            },
        ],
    },
    {
        'name': 'Morocco',
        'country_code': 'MA',
        'region': 'Africa',
        'incentive_type': 'CASH_REBATE',
        'base_percentage': 30.00,
        'min_spend': 100000.00,
        'max_rebate_cap': None,
        'currency': 'MAD',
        'is_capped': False,
        'is_stackable': False,
        'description': '30% cash rebate uncapped for foreign shoots. Strong below-the-line coverage.',
        'official_url': 'https://www.moroccofilm.com',
        'rules': [
            {
                'rule_type': 'MIN_SPEND',
                'configuration': {'amount': 100000, 'currency': 'USD'},
                'priority': 1,
            },
            {
                'rule_type': 'ELIGIBLE_CATEGORY',
                'configuration': {
                    'types': ['feature_film', 'tv_series', 'documentary', 'commercial'],
                    'description': 'Below-the-line spend strongly covered (crew, locations, equipment)',
                },
                'priority': 2,
            },
        ],
    },
]


class Command(BaseCommand):
    help = 'Seed priority EMEA/APAC territories with rules'

    def handle(self, *args, **kwargs):
        created_count = 0
        skipped_count = 0

        for t_data in TERRITORIES:
            rules_data = t_data.pop('rules', [])
            territory, created = Territory.objects.get_or_create(
                country_code=t_data['country_code'],
                defaults={**t_data, 'effective_date': '2024-01-01'},
            )

            if created:
                created_count += 1
                for rule in rules_data:
                    TerritoryRule.objects.get_or_create(
                        territory=territory,
                        rule_type=rule['rule_type'],
                        defaults={
                            'configuration': rule['configuration'],
                            'priority': rule['priority'],
                        },
                    )
                self.stdout.write(f"  Created: {territory.name} ({len(rules_data)} rules)")
            else:
                skipped_count += 1
                self.stdout.write(f"  Skipped (exists): {territory.name}")

        self.stdout.write(self.style.SUCCESS(
            f'\nDone — {created_count} created, {skipped_count} skipped.'
        ))
