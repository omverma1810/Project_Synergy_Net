from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import date
from accounts.models import Profile
from projects.models import Project, Budget, BudgetLineItem
from territories.models import (
    Territory, QualifiedSpendMapping, TerritoryComplianceChecklist,
    PolicyAlert, GenreIntelligenceProfile, TerritoryPartner,
)
from analysis.models import Analysis
from analysis.tasks import run_analysis

User = get_user_model()


TERRITORIES = [
    {
        'name': 'Saudi Film Commission',
        'country_code': 'SA',
        'region': 'Middle East',
        'incentive_type': 'CASH_REBATE',
        'base_percentage': 60,
        'min_spend': 500_000,
        'currency': 'USD',
        'is_capped': False,
        'is_stackable': False,
        'effective_date': date(2024, 1, 1),
        'rebate_timing_months_min': 6,
        'rebate_timing_months_max': 12,
        'loan_against_rebate_available': True,
        'description': (
            'Saudi Arabia offers a 60% cash rebate on qualifying local spend '
            'for international productions, raised from 40% in 2024 by the Saudi Film Commission.'
        ),
        'official_url': 'https://www.saudifilmcommission.org.sa',
    },
    {
        'name': 'Belgium Tax Shelter + Regional',
        'country_code': 'BE',
        'region': 'Western Europe',
        'incentive_type': 'TAX_SHELTER',
        'base_percentage': 35,
        'provincial_percentage': 0,
        'min_spend': 250_000,
        'currency': 'EUR',
        'is_capped': False,
        'is_stackable': True,
        'is_regional_stacking_eligible': True,
        'effective_date': date(2003, 1, 1),
        'rebate_timing_months_min': 12,
        'rebate_timing_months_max': 24,
        'loan_against_rebate_available': True,
        'description': (
            "Belgium's Tax Shelter can reach up to 66% when stacked with regional funds. "
            'Federal rate is 35% with additional regional incentives available.'
        ),
        'official_url': 'https://www.taxshelter.be',
    },
    {
        'name': 'UK — Audio Visual Expenditure Credit',
        'country_code': 'GB',
        'region': 'Western Europe',
        'incentive_type': 'TAX_CREDIT',
        'base_percentage': 25.5,
        'min_spend': 1_000_000,
        'currency': 'GBP',
        'is_capped': False,
        'is_stackable': False,
        'effective_date': date(2024, 1, 1),
        'rebate_timing_months_min': 12,
        'rebate_timing_months_max': 18,
        'loan_against_rebate_available': True,
        'description': (
            'UK AVEC (Audio Visual Expenditure Credit) provides 25.5% on qualifying UK spend, '
            'replacing the old Film Tax Relief from 2024.'
        ),
        'official_url': 'https://www.bfi.org.uk',
    },
    {
        'name': 'UK — High-End TV Credit',
        'country_code': 'GB_HETV',
        'region': 'Western Europe',
        'incentive_type': 'TAX_CREDIT',
        'base_percentage': 25.5,
        'min_spend': 1_000_000,
        'currency': 'GBP',
        'is_capped': False,
        'is_stackable': False,
        'effective_date': date(2024, 1, 1),
        'rebate_timing_months_min': 12,
        'rebate_timing_months_max': 18,
        'streaming_eligible': True,
        'description': 'UK HETV credit for high-end television productions at 25.5%.',
        'official_url': 'https://www.bfi.org.uk',
    },
    {
        'name': 'Ireland — Section 481',
        'country_code': 'IE',
        'region': 'Western Europe',
        'incentive_type': 'TAX_CREDIT',
        'base_percentage': 32,
        'min_spend': 50_000,
        'currency': 'EUR',
        'is_capped': False,
        'is_stackable': False,
        'effective_date': date(2015, 1, 1),
        'rebate_timing_months_min': 6,
        'rebate_timing_months_max': 12,
        'loan_against_rebate_available': True,
        'animation_eligible': True,
        'description': (
            'Ireland Section 481 provides a 32% tax credit on Irish qualifying expenditure '
            'for film, TV, animation, and documentary productions.'
        ),
        'official_url': 'https://www.revenue.ie',
    },
    {
        'name': 'Canary Islands — ZEC Film Rebate',
        'country_code': 'ES_CI',
        'region': 'Southern Europe',
        'incentive_type': 'TAX_CREDIT',
        'base_percentage': 50,
        'min_spend': 1_000_000,
        'max_rebate_cap': 36_000_000,
        'currency': 'EUR',
        'is_capped': True,
        'is_stackable': False,
        'effective_date': date(2016, 1, 1),
        'rebate_timing_months_min': 12,
        'rebate_timing_months_max': 24,
        'description': (
            'Canary Islands offers 50–54% tax rebate on qualifying local spend, '
            'one of the highest rates in Europe.'
        ),
        'official_url': 'https://www.grancanaria.com/filmcommission',
    },
    {
        'name': 'Hungary Film Incentive',
        'country_code': 'HU',
        'region': 'Eastern Europe',
        'incentive_type': 'TAX_CREDIT',
        'base_percentage': 30,
        'min_spend': 500_000,
        'currency': 'EUR',
        'is_capped': False,
        'is_stackable': False,
        'effective_date': date(2004, 1, 1),
        'rebate_timing_months_min': 12,
        'rebate_timing_months_max': 18,
        'description': (
            'Hungary offers a 30% tax credit on eligible Hungarian spend, '
            'popular for large-scale action and fantasy productions.'
        ),
        'official_url': 'https://nfi.hu',
    },
    {
        'name': 'Serbia Film Incentive',
        'country_code': 'RS',
        'region': 'Eastern Europe',
        'incentive_type': 'CASH_REBATE',
        'base_percentage': 25,
        'min_spend': 200_000,
        'currency': 'EUR',
        'is_capped': False,
        'is_stackable': False,
        'effective_date': date(2016, 1, 1),
        'rebate_timing_months_min': 6,
        'rebate_timing_months_max': 12,
        'description': 'Serbia offers 25–30% cash rebate on eligible local production spend.',
        'official_url': 'https://www.filmserbia.com',
    },
    {
        'name': 'Australia — Location Offset',
        'country_code': 'AU',
        'region': 'Asia Pacific',
        'incentive_type': 'TAX_CREDIT',
        'base_percentage': 30,
        'min_spend': 15_000_000,
        'currency': 'AUD',
        'is_capped': False,
        'is_stackable': False,
        'effective_date': date(2007, 7, 1),
        'rebate_timing_months_min': 12,
        'rebate_timing_months_max': 24,
        'description': (
            'Australia Location Offset provides 30% on qualifying Australian production expenditure '
            'for large budget international productions.'
        ),
        'official_url': 'https://www.screenaustralia.gov.au',
    },
    {
        'name': 'Australia — PDV Offset',
        'country_code': 'AU_PDV',
        'region': 'Asia Pacific',
        'incentive_type': 'TAX_CREDIT',
        'base_percentage': 30,
        'min_spend': 500_000,
        'currency': 'AUD',
        'is_capped': False,
        'is_stackable': False,
        'effective_date': date(2007, 7, 1),
        'rebate_timing_months_min': 12,
        'rebate_timing_months_max': 18,
        'description': (
            'Australia Post, Digital & Visual Effects (PDV) Offset: 30% on qualifying '
            'Australian PDV expenditure for international productions.'
        ),
        'official_url': 'https://www.screenaustralia.gov.au',
    },
    {
        'name': 'UAE — Abu Dhabi Film Commission',
        'country_code': 'AE',
        'region': 'Middle East',
        'incentive_type': 'CASH_REBATE',
        'base_percentage': 30,
        'min_spend': 250_000,
        'currency': 'USD',
        'is_capped': False,
        'is_stackable': False,
        'effective_date': date(2012, 1, 1),
        'rebate_timing_months_min': 6,
        'rebate_timing_months_max': 12,
        'description': (
            'Abu Dhabi Film Commission offers a 30% cash rebate on qualifying local spend '
            'for film and high-end TV productions.'
        ),
        'official_url': 'https://adfilm.ae',
    },
    {
        'name': 'Canada Federal — CPTC',
        'country_code': 'CA',
        'region': 'North America',
        'incentive_type': 'TAX_CREDIT',
        'base_percentage': 16,
        'min_spend': 100_000,
        'currency': 'CAD',
        'is_capped': False,
        'is_stackable': True,
        'effective_date': date(1996, 1, 1),
        'rebate_timing_months_min': 12,
        'rebate_timing_months_max': 24,
        'description': (
            'Canada federal Canadian Film or Video Production Tax Credit (CPTC) at 16%. '
            'Can be stacked with provincial credits.'
        ),
        'official_url': 'https://www.canada.ca/cptc',
    },
    {
        'name': 'Canada — British Columbia PSTC',
        'country_code': 'CA_BC',
        'region': 'North America',
        'incentive_type': 'TAX_CREDIT',
        'base_percentage': 35,
        'min_spend': 100_000,
        'currency': 'CAD',
        'is_capped': False,
        'is_stackable': False,
        'effective_date': date(1998, 1, 1),
        'rebate_timing_months_min': 12,
        'rebate_timing_months_max': 24,
        'description': (
            'British Columbia Production Services Tax Credit (PSTC) at 35% on BC labour. '
            'Combined with federal credit gives 35%+ effective rate.'
        ),
        'official_url': 'https://www.creativebc.com',
    },
    {
        'name': 'Morocco — CNC Incentive',
        'country_code': 'MA',
        'region': 'North Africa',
        'incentive_type': 'CASH_REBATE',
        'base_percentage': 30,
        'min_spend': 100_000,
        'max_rebate_cap': 1_000_000,
        'currency': 'USD',
        'is_capped': True,
        'is_stackable': False,
        'effective_date': date(2018, 1, 1),
        'rebate_timing_months_min': 6,
        'rebate_timing_months_max': 12,
        'description': (
            'Morocco Centre Cinématographique Marocain offers 30% cash rebate '
            'on qualifying local production expenditure.'
        ),
        'official_url': 'https://www.ccm.ma',
    },
    {
        'name': 'Poland Film Institute Incentive',
        'country_code': 'PL',
        'region': 'Eastern Europe',
        'incentive_type': 'CASH_REBATE',
        'base_percentage': 30,
        'min_spend': 1_000_000,
        'currency': 'PLN',
        'is_capped': False,
        'is_stackable': False,
        'effective_date': date(2018, 1, 1),
        'rebate_timing_months_min': 12,
        'rebate_timing_months_max': 18,
        'description': (
            'Poland Polish Film Institute (PISF) offers 30% cash rebate on qualifying '
            'Polish production expenditure.'
        ),
        'official_url': 'https://pisf.pl',
    },
    {
        'name': 'Romanian Film Center — Updated',
        'country_code': 'RO',
        'region': 'Eastern Europe',
        'incentive_type': 'TAX_CREDIT',
        'base_percentage': 35,
        'min_spend': 250_000,
        'max_rebate_cap': 2_000_000,
        'currency': 'EUR',
        'is_capped': True,
        'is_stackable': False,
        'effective_date': date(2023, 1, 1),
        'rebate_timing_months_min': 12,
        'rebate_timing_months_max': 18,
        'description': (
            'Romania updated its film incentive to 35% tax credit on eligible local expenditure, '
            'capped at €2M per project, administered by the National Film Center.'
        ),
        'official_url': 'https://www.cnc.ro',
    },
]

# Compliance items per territory (country_code -> list of items)
COMPLIANCE_ITEMS = {
    'SA': [
        ('APPLICATION', 'Register with Saudi Film Commission before shoot', 'BEFORE_SHOOT', True),
        ('DOCUMENT', 'Production plan and budget breakdown submission', 'BEFORE_SHOOT', True),
        ('MILESTONE', 'Minimum 50% of spend must be on Saudi locals or in-Kingdom goods', 'DURING_SHOOT', True),
        ('AUDIT', 'Post-production spend audit by approved local CPA', 'AFTER_SHOOT', True),
        ('DOCUMENT', 'Final cost report with receipts', 'AFTER_DELIVERY', True),
    ],
    'BE': [
        ('APPLICATION', 'Register with Belgian Tax Shelter intermediary', 'BEFORE_SHOOT', True),
        ('DOCUMENT', 'Frame Agreement with Belgian investor', 'BEFORE_SHOOT', True),
        ('MILESTONE', 'Minimum 150% of Tax Shelter amount spent in Belgium', 'DURING_SHOOT', True),
        ('AUDIT', 'Certified public accountant sign-off on Belgian expenditure', 'AFTER_DELIVERY', True),
    ],
    'IE': [
        ('APPLICATION', 'Provisional certification from Revenue Commissioners', 'BEFORE_SHOOT', True),
        ('DOCUMENT', 'Cultural Certificate from Screen Ireland', 'BEFORE_SHOOT', True),
        ('MILESTONE', 'Minimum 10% of qualifying spend in Ireland', 'DURING_SHOOT', True),
        ('DOCUMENT', 'Audited cost statement from Irish CPA', 'AFTER_DELIVERY', True),
    ],
    'GB': [
        ('DOCUMENT', 'Cultural test certification (BFI)', 'BEFORE_SHOOT', True),
        ('MILESTONE', '80% of UK core expenditure must be UK spend', 'DURING_SHOOT', True),
        ('AUDIT', 'Certified cost report by UK accountant', 'AFTER_DELIVERY', True),
    ],
    'HU': [
        ('APPLICATION', 'Register with National Film Institute Hungary', 'BEFORE_SHOOT', True),
        ('DOCUMENT', 'Hungarian Service Contract with local production company', 'BEFORE_SHOOT', True),
        ('AUDIT', 'Hungarian CPA audit of eligible spend', 'AFTER_SHOOT', True),
    ],
    'AU': [
        ('APPLICATION', 'Screen Australia project registration', 'BEFORE_SHOOT', True),
        ('DOCUMENT', 'QAPE (Qualifying Australian Production Expenditure) certification', 'BEFORE_SHOOT', True),
        ('AUDIT', 'Certified QAPE audit by Australian registered company auditor', 'AFTER_DELIVERY', True),
    ],
    'MA': [
        ('APPLICATION', 'CCM authorization letter', 'BEFORE_SHOOT', True),
        ('DOCUMENT', 'Local co-production or service agreement', 'BEFORE_SHOOT', True),
        ('MILESTONE', 'Minimum number of Moroccan crew members', 'DURING_SHOOT', True),
    ],
    'RO': [
        ('APPLICATION', 'National Film Center (CNC) registration', 'BEFORE_SHOOT', True),
        ('DOCUMENT', 'Budget certification and spend plan', 'BEFORE_SHOOT', True),
        ('AUDIT', 'Romanian CPA certified cost report', 'AFTER_DELIVERY', True),
    ],
}

# Genre intelligence: territory code -> genre -> bonus%
GENRE_PROFILES = {
    'IE': {'animation': 5.0, 'documentary': 3.0},
    'BE': {'animation': 4.0, 'documentary': 2.0},
    'HU': {'sci_fi': 2.0, 'action': 2.0},
    'AU': {'streaming': 3.0, 'sci_fi': 2.0},
    'GB': {'streaming': 2.0, 'documentary': 2.0},
    'ES_CI': {'documentary': 4.0},
}

# Partner seed data
PARTNERS = [
    ('SA', 'Al-Majd Production Services', 'line_producer', 'info@almajd.sa', True),
    ('SA', 'Riyadh Tax Advisors DMCC', 'cpa', 'tax@riyadh-advisors.com', True),
    ('BE', 'Brussels Media Finance', 'cpa', 'info@bmf.be', True),
    ('BE', 'Flanders Line Producing', 'line_producer', 'contact@flanders-lp.be', True),
    ('IE', 'Dublin Screen Accountants', 'cpa', 'info@dublinscreen.ie', True),
    ('GB', 'London Production Services', 'line_producer', 'info@londonps.co.uk', False),
    ('RO', 'Bucharest Film Fixer', 'fixer', 'info@bucharestfilm.ro', True),
    ('HU', 'Budapest Production Finance', 'cpa', 'info@bpf.hu', True),
    ('MA', 'Casablanca Film Fixers', 'fixer', 'info@casablancafilm.ma', False),
    ('AU', 'Sydney Screen Finance', 'cpa', 'info@sydneyscreen.com.au', True),
]

# Spend mappings common to all territories
COMMON_MAPPINGS = [
    ('Crew', 'Local Crew', 100),
    ('Production', 'Local Production', 100),
    ('Equipment', 'Local Equipment', 100),
    ('Locations', 'Location Fees', 100),
    ('Catering', 'Catering Services', 100),
    ('Transport', 'Local Transport', 100),
    ('Construction', 'Set Building', 100),
    ('Insurance', 'Production Insurance', 80),
    ('Post Production', 'Post Production', 100),
]

LINE_ITEMS = [
    {'account_code': '1000', 'description': 'Director', 'category': 'Above the Line', 'amount': 150_000, 'is_above_the_line': True, 'is_local_eligible': False},
    {'account_code': '2000', 'description': 'Local Production Manager', 'category': 'Production', 'amount': 45_000, 'is_local_eligible': True},
    {'account_code': '3000', 'description': 'Camera Equipment Rental', 'category': 'Equipment', 'amount': 120_000, 'is_local_eligible': True},
    {'account_code': '4000', 'description': 'Local Crew (Grips, Electric)', 'category': 'Crew', 'amount': 85_000, 'is_local_eligible': True},
    {'account_code': '5000', 'description': 'Location Fees - Desert', 'category': 'Locations', 'amount': 65_000, 'is_local_eligible': True},
    {'account_code': '6000', 'description': 'Catering & Craft Services', 'category': 'Catering', 'amount': 35_000, 'is_local_eligible': True},
    {'account_code': '7000', 'description': 'Transportation - Local', 'category': 'Transport', 'amount': 28_000, 'is_local_eligible': True},
    {'account_code': '8000', 'description': 'Set Construction', 'category': 'Construction', 'amount': 95_000, 'is_local_eligible': True},
    {'account_code': '9000', 'description': 'Visual Effects', 'category': 'Post Production', 'amount': 200_000, 'is_local_eligible': True},
    {'account_code': '9500', 'description': 'Insurance', 'category': 'Insurance', 'amount': 45_000, 'is_local_eligible': True},
]


class Command(BaseCommand):
    help = 'Seed demo data — 15+ territories, compliance checklists, genre profiles, partners'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding demo data...\n')

        # 1. Demo user
        user, created = User.objects.get_or_create(
            email='demo@synergy.net',
            defaults={
                'username': 'demo',
                'first_name': 'Demo',
                'last_name': 'Producer',
                'role': 'PRODUCER',
                'company_name': 'Demo Films Ltd',
                'is_verified': True,
            },
        )
        if created:
            user.set_password('demo123')
            user.save()
            self.stdout.write('  Created user demo@synergy.net / demo123')
        Profile.objects.get_or_create(user=user, defaults={'producer_type': 'MID_MARKET'})

        # 2. Territories
        territory_objs = {}
        for t_data in TERRITORIES:
            country_code = t_data['country_code']
            t_defaults = {k: v for k, v in t_data.items() if k != 'country_code'}
            t_defaults['status'] = 'ACTIVE'
            t, t_created = Territory.objects.get_or_create(
                country_code=country_code,
                defaults=t_defaults,
            )
            if not t_created:
                # Update key fields on existing records
                for field in ['base_percentage', 'description', 'rebate_timing_months_min', 'rebate_timing_months_max', 'loan_against_rebate_available']:
                    if field in t_defaults:
                        setattr(t, field, t_defaults[field])
                t.save()
            territory_objs[country_code] = t
            action = 'Created' if t_created else 'Updated'
            self.stdout.write(f'  {action} territory: {t.name} ({t.base_percentage}%)')

        # 3. Spend mappings
        for code, t in territory_objs.items():
            QualifiedSpendMapping.objects.filter(territory=t).delete()
            for pattern, mapped, pct in COMMON_MAPPINGS:
                QualifiedSpendMapping.objects.create(
                    territory=t,
                    budget_category_pattern=pattern,
                    mapped_eligible_category=mapped,
                    eligibility_percentage=pct,
                )

        # 4. Compliance checklists
        for code, items in COMPLIANCE_ITEMS.items():
            if code not in territory_objs:
                continue
            t = territory_objs[code]
            TerritoryComplianceChecklist.objects.filter(territory=t).delete()
            for idx, (item_type, description, deadline_type, is_mandatory) in enumerate(items):
                TerritoryComplianceChecklist.objects.create(
                    territory=t,
                    item_type=item_type,
                    description=description,
                    deadline_type=deadline_type,
                    is_mandatory=is_mandatory,
                    sort_order=idx,
                )

        # 5. Genre profiles
        for code, genres in GENRE_PROFILES.items():
            if code not in territory_objs:
                continue
            t = territory_objs[code]
            for genre, bonus in genres.items():
                GenreIntelligenceProfile.objects.update_or_create(
                    territory=t, genre=genre,
                    defaults={'bonus_percentage': bonus},
                )

        # 6. Partners
        for code, name, ptype, email, vetted in PARTNERS:
            if code not in territory_objs:
                continue
            t = territory_objs[code]
            TerritoryPartner.objects.get_or_create(
                territory=t, name=name,
                defaults={'partner_type': ptype, 'email': email, 'is_vetted': vetted},
            )

        # 7. Policy alerts
        PolicyAlert.objects.get_or_create(
            title='Saudi Arabia rebate raised to 60%',
            defaults={
                'territory': territory_objs.get('SA'),
                'description': 'Saudi Film Commission increased the cash rebate from 40% to 60% effective January 2024.',
                'change_type': 'RATE_CHANGE',
                'previous_value': '40%',
                'new_value': '60%',
                'effective_date': date(2024, 1, 1),
                'is_active': True,
            },
        )
        PolicyAlert.objects.get_or_create(
            title='UK AVEC replaces Film Tax Relief',
            defaults={
                'territory': territory_objs.get('GB'),
                'description': 'UK Audio Visual Expenditure Credit (AVEC) at 25.5% replaces the legacy Film Tax Relief.',
                'change_type': 'RULE_CHANGE',
                'previous_value': 'Film Tax Relief 20%',
                'new_value': 'AVEC 25.5%',
                'effective_date': date(2024, 1, 1),
                'is_active': True,
            },
        )

        # 8. Project
        project, _ = Project.objects.get_or_create(
            slug='desert-wind',
            defaults={
                'producer': user,
                'title': 'Desert Wind',
                'type': 'FEATURE',
                'genre': 'action',
                'language': 'English',
                'synopsis': 'A mid-budget action thriller set across the Middle East and Europe.',
                'total_budget': 2_500_000.00,
                'currency': 'USD',
                'shoot_duration_days': 45,
                'status': 'DRAFT',
                'spend_estimates': {
                    'Local Crew': 85000,
                    'Equipment': 120000,
                    'Locations': 65000,
                    'Set Construction': 95000,
                    'Post Production': 200000,
                },
            },
        )
        self.stdout.write(f'\n  Project: {project.title}')

        # 9. Budget & line items
        budget, _ = Budget.objects.get_or_create(
            project=project,
            file_name='desert_wind_budget.csv',
            defaults={
                'file_type': 'CSV',
                'extraction_status': 'EXTRACTED',
                'confidence_score': 0.92,
                'extracted_at': timezone.now(),
            },
        )
        BudgetLineItem.objects.filter(budget=budget).delete()
        for idx, item in enumerate(LINE_ITEMS):
            BudgetLineItem.objects.create(budget=budget, sort_order=idx, currency='USD', **item)
        self.stdout.write(f'  Created {len(LINE_ITEMS)} budget line items')

        # 10. Run analysis
        from analysis.models import AnalysisResult
        Analysis.objects.filter(project=project).delete()
        analysis = Analysis.objects.create(project=project, budget=budget, triggered_by='USER')
        run_analysis(analysis.id)

        self.stdout.write(self.style.SUCCESS('\nDemo data seeded successfully!'))
        self.stdout.write(f'  Login:    demo@synergy.net / demo123')
        self.stdout.write(f'  Analysis: /analysis?id={analysis.id}')
        self.stdout.write(f'  Active territories: {Territory.objects.filter(status="ACTIVE").count()}')
        self.stdout.write('\n  Territory rankings:')
        for r in AnalysisResult.objects.filter(analysis=analysis).order_by('rank'):
            self.stdout.write(
                f'    #{r.rank:2d}  {r.territory.name:<45} ({r.territory.base_percentage}%) '
                f'net: ${r.net_benefit:>12,.0f}  financing PV: ${r.financing_benefit_estimate:>12,.0f}'
            )
