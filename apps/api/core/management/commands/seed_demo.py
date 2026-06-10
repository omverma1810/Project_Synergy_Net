from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import date
from accounts.models import Profile
from projects.models import Project, Budget, BudgetLineItem
from territories.models import Territory, QualifiedSpendMapping
from analysis.models import Analysis
from analysis.tasks import run_analysis

User = get_user_model()


TERRITORIES = [
    {
        'name': 'Saudi Film Commission',
        'country_code': 'SA',
        'region': 'Middle East',
        'incentive_type': 'CASH_REBATE',
        'base_percentage': 40,
        'min_spend': 500_000,
        'max_rebate_cap': None,
        'currency': 'USD',
        'is_capped': False,
        'is_stackable': False,
        'effective_date': date(2021, 1, 1),
        'description': (
            'Saudi Arabia offers a 40% cash rebate on qualifying local spend '
            'for international productions shooting in the Kingdom.'
        ),
        'official_url': 'https://www.saudifilemcommission.com',
    },
    {
        'name': 'Belgium Tax Shelter',
        'country_code': 'BE',
        'region': 'Western Europe',
        'incentive_type': 'TAX_SHELTER',
        'base_percentage': 35,
        'min_spend': None,
        'max_rebate_cap': None,
        'currency': 'EUR',
        'is_capped': False,
        'is_stackable': True,
        'effective_date': date(2003, 1, 1),
        'description': (
            'Belgium\'s Tax Shelter allows private investors to reduce their '
            'taxable income by investing in Belgian audiovisual works.'
        ),
        'official_url': 'https://www.taxshelter.be',
    },
    {
        'name': 'Romanian Film Center',
        'country_code': 'RO',
        'region': 'Eastern Europe',
        'incentive_type': 'TAX_CREDIT',
        'base_percentage': 25,
        'min_spend': 250_000,
        'max_rebate_cap': 1_000_000,
        'currency': 'EUR',
        'is_capped': True,
        'is_stackable': False,
        'effective_date': date(2015, 6, 1),
        'description': (
            'Romania offers a 25% tax credit on eligible local expenditure, '
            'capped at €1M per project, administered by the National Film Center.'
        ),
        'official_url': 'https://www.cnc.ro',
    },
    {
        'name': 'UK Film Tax Relief',
        'country_code': 'GB',
        'region': 'Western Europe',
        'incentive_type': 'TAX_CREDIT',
        'base_percentage': 20,
        'min_spend': 100_000,
        'max_rebate_cap': None,
        'currency': 'GBP',
        'is_capped': False,
        'is_stackable': False,
        'effective_date': date(2007, 1, 1),
        'description': (
            'The UK Film Tax Relief provides a 20% tax credit on UK core '
            'expenditure for qualifying film productions.'
        ),
        'official_url': 'https://www.bfi.org.uk/industry-data-finance/financing/uk-film-tax-relief',
    },
    {
        'name': 'Morocco CCIS Incentive',
        'country_code': 'MA',
        'region': 'North Africa',
        'incentive_type': 'CASH_REBATE',
        'base_percentage': 20,
        'min_spend': None,
        'max_rebate_cap': 500_000,
        'currency': 'USD',
        'is_capped': True,
        'is_stackable': False,
        'effective_date': date(2018, 1, 1),
        'description': (
            'Morocco\'s CCIS offers a 20% cash rebate on qualifying local '
            'production spend, capped at $500K, targeting international shoots.'
        ),
        'official_url': 'https://www.ccis.ma',
    },
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
    {'account_code': '9000', 'description': 'Visual Effects', 'category': 'Post Production', 'amount': 200_000, 'is_local_eligible': False},
    {'account_code': '9500', 'description': 'Insurance', 'category': 'Insurance', 'amount': 45_000, 'is_local_eligible': True},
]

# Category spend mappings for Saudi Arabia and Belgium to enrich analysis
SA_MAPPINGS = [
    ('Crew', 'Local Crew', 100),
    ('Production', 'Local Production', 100),
    ('Equipment', 'Local Equipment', 100),
    ('Locations', 'Location Fees', 100),
    ('Catering', 'Catering Services', 100),
    ('Transport', 'Local Transport', 100),
    ('Construction', 'Set Building', 100),
    ('Insurance', 'Production Insurance', 80),
]

BE_MAPPINGS = [
    ('Crew', 'Local Crew Costs', 100),
    ('Production', 'Production Services', 100),
    ('Equipment', 'Equipment Hire', 100),
    ('Locations', 'Location Costs', 100),
    ('Construction', 'Set Construction', 100),
    ('Transport', 'Transport & Logistics', 100),
]


class Command(BaseCommand):
    help = 'Seed demo data for presentation'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding demo data...')

        # ── 1. Demo user ──────────────────────────────────────────────────────
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
            self.stdout.write('  Created user demo@synergy.net')
        Profile.objects.get_or_create(user=user, defaults={'producer_type': 'MID_MARKET'})

        # ── 2. Territories ────────────────────────────────────────────────────
        territory_objs = {}
        for t_data in TERRITORIES:
            t, t_created = Territory.objects.get_or_create(
                country_code=t_data['country_code'],
                name=t_data['name'],
                defaults={**t_data, 'status': 'ACTIVE'},
            )
            territory_objs[t_data['country_code']] = t
            if t_created:
                self.stdout.write(f"  Created territory: {t.name}")

        # Spend mappings for richer analysis output
        sa = territory_objs['SA']
        QualifiedSpendMapping.objects.filter(territory=sa).delete()
        for pattern, mapped, pct in SA_MAPPINGS:
            QualifiedSpendMapping.objects.create(
                territory=sa,
                budget_category_pattern=pattern,
                mapped_eligible_category=mapped,
                eligibility_percentage=pct,
            )

        be = territory_objs['BE']
        QualifiedSpendMapping.objects.filter(territory=be).delete()
        for pattern, mapped, pct in BE_MAPPINGS:
            QualifiedSpendMapping.objects.create(
                territory=be,
                budget_category_pattern=pattern,
                mapped_eligible_category=mapped,
                eligibility_percentage=pct,
            )

        # ── 3. Project ────────────────────────────────────────────────────────
        project, _ = Project.objects.get_or_create(
            slug='desert-wind',
            defaults={
                'producer': user,
                'title': 'Desert Wind',
                'type': 'FEATURE',
                'genre': 'Action/Thriller',
                'language': 'English',
                'synopsis': 'A mid-budget action thriller set in the Middle East.',
                'total_budget': 2_500_000.00,
                'currency': 'USD',
                'shoot_duration_days': 45,
                'status': 'DRAFT',
            },
        )
        self.stdout.write(f"  Project: {project.title}")

        # ── 4. Budget & line items ────────────────────────────────────────────
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
            BudgetLineItem.objects.create(
                budget=budget, sort_order=idx, currency='USD', **item
            )
        self.stdout.write(f"  Created {len(LINE_ITEMS)} budget line items")

        # ── 5. Run analysis ───────────────────────────────────────────────────
        # Delete any stale results from previous seed runs
        Analysis.objects.filter(project=project).delete()

        analysis = Analysis.objects.create(
            project=project, budget=budget, triggered_by='USER'
        )
        run_analysis(analysis.id)

        self.stdout.write(self.style.SUCCESS('\nDemo data seeded successfully!'))
        self.stdout.write(f'  Login:    demo@synergy.net / demo123')
        self.stdout.write(f'  Analysis: /analysis?id={analysis.id}')
        self.stdout.write(f'  Territories: {Territory.objects.filter(status="ACTIVE").count()} active')

        # Print the ranking for quick verification
        from analysis.models import AnalysisResult
        self.stdout.write('\n  Territory rankings:')
        for r in AnalysisResult.objects.filter(analysis=analysis).order_by('rank'):
            self.stdout.write(
                f'    #{r.rank} {r.territory.name} ({r.territory.base_percentage}%) '
                f'→ net benefit: {r.net_benefit:,.0f} {r.currency}'
            )
