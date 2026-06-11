"""
Unit tests for IncentiveEngine — covers rebate calculation, stacking,
genre bonuses, cap enforcement, financing PV, and territory ranking.
"""
from decimal import Decimal
from django.test import TestCase
from unittest.mock import patch, MagicMock
from datetime import date
from territories.models import Territory, QualifiedSpendMapping, GenreIntelligenceProfile
from projects.models import Project, Budget, BudgetLineItem
from accounts.models import User
from analysis.engine import IncentiveEngine


def make_user():
    return User.objects.create_user(
        username='test', email='test@test.com', password='test123',
        role='PRODUCER',
    )


def make_project(user):
    return Project.objects.create(
        title='Test Film', slug='test-film', producer=user,
        type='FEATURE', genre='action', total_budget=1_000_000, currency='USD',
    )


def make_budget(project):
    return Budget.objects.create(
        project=project, file_name='test.csv', file_type='CSV',
        extraction_status='EXTRACTED',
    )


def make_line_item(budget, description, category, amount, is_local_eligible=True):
    return BudgetLineItem.objects.create(
        budget=budget, description=description, category=category,
        amount=amount, currency='USD', is_local_eligible=is_local_eligible,
    )


def make_territory(**kwargs):
    defaults = dict(
        name='Test Territory', country_code='XX', region='Test',
        incentive_type='CASH_REBATE', base_percentage=30,
        provincial_percentage=0, currency='USD', is_capped=False,
        is_stackable=False, is_regional_stacking_eligible=False,
        status='ACTIVE', effective_date=date(2020, 1, 1),
        rebate_timing_months_min=6, rebate_timing_months_max=12,
        loan_against_rebate_available=False,
    )
    defaults.update(kwargs)
    return Territory.objects.create(**defaults)


class TestIncentiveEngineBasic(TestCase):
    def setUp(self):
        self.user = make_user()
        self.project = make_project(self.user)
        self.budget = make_budget(self.project)

    def test_simple_rebate_calculation(self):
        """30% rebate on $500k local-eligible spend = $150k rebate."""
        make_line_item(self.budget, 'Local Crew', 'Crew', 500_000)
        territory = make_territory(base_percentage=30)
        engine = IncentiveEngine(self.budget)
        result = engine.analyze_territory(territory)

        self.assertIsNotNone(result)
        self.assertEqual(result['estimated_rebate'], Decimal('150000.00'))

    def test_min_spend_threshold_rejects(self):
        """Territory with $1M min spend rejects $500k budget."""
        make_line_item(self.budget, 'Crew', 'Crew', 300_000)
        territory = make_territory(min_spend=1_000_000)
        engine = IncentiveEngine(self.budget)
        result = engine.analyze_territory(territory)

        self.assertIsNone(result)

    def test_min_spend_threshold_passes(self):
        """Territory with $200k min spend accepts $500k budget."""
        make_line_item(self.budget, 'Crew', 'Crew', 500_000)
        territory = make_territory(min_spend=200_000)
        engine = IncentiveEngine(self.budget)
        result = engine.analyze_territory(territory)

        self.assertIsNotNone(result)

    def test_rebate_cap_enforced(self):
        """Rebate is capped at max_rebate_cap even if calculated higher."""
        make_line_item(self.budget, 'Crew', 'Crew', 1_000_000)
        territory = make_territory(
            base_percentage=50, is_capped=True, max_rebate_cap=100_000
        )
        engine = IncentiveEngine(self.budget)
        result = engine.analyze_territory(territory)

        self.assertEqual(result['estimated_rebate'], Decimal('100000'))

    def test_cap_not_applied_when_below_cap(self):
        """Rebate not capped when below max_rebate_cap."""
        make_line_item(self.budget, 'Crew', 'Crew', 100_000)
        territory = make_territory(
            base_percentage=20, is_capped=True, max_rebate_cap=500_000
        )
        engine = IncentiveEngine(self.budget)
        result = engine.analyze_territory(territory)

        self.assertEqual(result['estimated_rebate'], Decimal('20000.00'))

    def test_non_local_items_not_included_without_mapping(self):
        """Non-local-eligible items with no mapping contribute 0."""
        make_line_item(self.budget, 'Director Fee', 'ATL', 200_000, is_local_eligible=False)
        territory = make_territory(base_percentage=30)
        engine = IncentiveEngine(self.budget)
        result = engine.analyze_territory(territory)

        self.assertEqual(result['qualified_spend_total'], Decimal('0'))
        self.assertEqual(result['estimated_rebate'], Decimal('0'))


class TestIncentiveEngineStacking(TestCase):
    def setUp(self):
        self.user = make_user()
        self.project = make_project(self.user)
        self.budget = make_budget(self.project)
        make_line_item(self.budget, 'Local Crew', 'Crew', 500_000)

    def test_stacking_adds_provincial(self):
        """Stackable territory with 16% base + 19% provincial = 35% effective."""
        territory = make_territory(
            base_percentage=16, provincial_percentage=19, is_stackable=True
        )
        engine = IncentiveEngine(self.budget)
        result = engine.analyze_territory(territory)

        # 35% of 500k = 175k
        self.assertEqual(result['estimated_rebate_pct'], Decimal('35'))
        self.assertEqual(result['estimated_rebate'], Decimal('175000.00'))

    def test_non_stackable_ignores_provincial(self):
        """Non-stackable territory ignores provincial_percentage."""
        territory = make_territory(
            base_percentage=16, provincial_percentage=19, is_stackable=False
        )
        engine = IncentiveEngine(self.budget)
        result = engine.analyze_territory(territory)

        # 16% only
        self.assertEqual(result['estimated_rebate_pct'], Decimal('16'))


class TestIncentiveEngineGenreBonus(TestCase):
    def setUp(self):
        self.user = make_user()
        self.project = make_project(self.user)
        self.project.genre = 'animation'
        self.project.save()
        self.budget = make_budget(self.project)
        make_line_item(self.budget, 'Animation', 'Animation', 500_000)

    def test_genre_bonus_applied(self):
        """Animation bonus of 5% adds to base 32% = 37% effective."""
        territory = make_territory(base_percentage=32, country_code='IE_TEST')
        GenreIntelligenceProfile.objects.create(
            territory=territory, genre='animation', bonus_percentage=5
        )
        engine = IncentiveEngine(self.budget)
        result = engine.analyze_territory(territory)

        self.assertEqual(result['estimated_rebate_pct'], Decimal('37'))

    def test_no_genre_bonus_for_different_genre(self):
        """Drama project doesn't get animation bonus."""
        self.project.genre = 'drama'
        self.project.save()
        territory = make_territory(base_percentage=32)
        GenreIntelligenceProfile.objects.create(
            territory=territory, genre='animation', bonus_percentage=5
        )
        engine = IncentiveEngine(self.budget)
        result = engine.analyze_territory(territory)

        self.assertEqual(result['estimated_rebate_pct'], Decimal('32'))


class TestIncentiveEngineFinancing(TestCase):
    def setUp(self):
        self.user = make_user()
        self.project = make_project(self.user)
        self.budget = make_budget(self.project)
        make_line_item(self.budget, 'Crew', 'Crew', 1_000_000)

    def test_financing_pv_less_than_rebate(self):
        """financing_benefit_estimate < estimated_rebate due to discount."""
        territory = make_territory(
            base_percentage=30,
            rebate_timing_months_min=12,
            rebate_timing_months_max=24,
        )
        engine = IncentiveEngine(self.budget)
        result = engine.analyze_territory(territory)

        self.assertLess(result['financing_benefit_estimate'], result['estimated_rebate'])

    def test_faster_payout_has_higher_pv(self):
        """Territory with 6-month payout has higher PV than 18-month."""
        fast = make_territory(
            base_percentage=30, country_code='FAST',
            rebate_timing_months_min=3, rebate_timing_months_max=6,
        )
        slow = make_territory(
            base_percentage=30, country_code='SLOW',
            rebate_timing_months_min=18, rebate_timing_months_max=24,
        )
        engine = IncentiveEngine(self.budget)
        r_fast = engine.analyze_territory(fast)
        r_slow = engine.analyze_territory(slow)

        self.assertGreater(r_fast['financing_benefit_estimate'], r_slow['financing_benefit_estimate'])


class TestIncentiveEngineRanking(TestCase):
    def setUp(self):
        self.user = make_user()
        self.project = make_project(self.user)
        self.budget = make_budget(self.project)
        make_line_item(self.budget, 'Crew', 'Crew', 1_000_000)

    def test_ranks_by_net_benefit(self):
        """High rebate territory ranks #1 even with higher logistics."""
        high_rebate = make_territory(base_percentage=60, country_code='HR')
        low_rebate = make_territory(base_percentage=20, country_code='LR')
        engine = IncentiveEngine(self.budget)
        ranked = engine.rank_territories([low_rebate, high_rebate])

        self.assertEqual(ranked[0]['territory'].country_code, 'HR')
        self.assertEqual(ranked[0]['rank'], 1)
        self.assertEqual(ranked[1]['rank'], 2)

    def test_min_spend_excluded_from_ranking(self):
        """Territory that doesn't meet min_spend is excluded from results."""
        eligible = make_territory(base_percentage=30, country_code='EL', min_spend=100_000)
        ineligible = make_territory(base_percentage=50, country_code='IN', min_spend=5_000_000)
        engine = IncentiveEngine(self.budget)
        ranked = engine.rank_territories([eligible, ineligible])

        codes = [r['territory'].country_code for r in ranked]
        self.assertIn('EL', codes)
        self.assertNotIn('IN', codes)

    def test_empty_territories_returns_empty(self):
        engine = IncentiveEngine(self.budget)
        ranked = engine.rank_territories([])
        self.assertEqual(ranked, [])


class TestQualifiedSpendMapping(TestCase):
    def setUp(self):
        self.user = make_user()
        self.project = make_project(self.user)
        self.budget = make_budget(self.project)
        self.territory = make_territory(base_percentage=40)

    def test_mapping_pattern_matches_category(self):
        """Spend mapping matches budget category pattern."""
        make_line_item(self.budget, 'Camera Operator', 'Crew', 100_000)
        QualifiedSpendMapping.objects.create(
            territory=self.territory,
            budget_category_pattern='crew',
            mapped_eligible_category='Local Crew',
            eligibility_percentage=100,
        )
        engine = IncentiveEngine(self.budget)
        result = engine.analyze_territory(self.territory)

        self.assertEqual(result['qualified_spend_total'], Decimal('100000'))

    def test_partial_eligibility_percentage(self):
        """80% eligibility on $100k item = $80k qualified."""
        make_line_item(self.budget, 'Insurance', 'Insurance', 100_000)
        QualifiedSpendMapping.objects.create(
            territory=self.territory,
            budget_category_pattern='insurance',
            mapped_eligible_category='Production Insurance',
            eligibility_percentage=80,
        )
        engine = IncentiveEngine(self.budget)
        result = engine.analyze_territory(self.territory)

        self.assertEqual(result['qualified_spend_total'], Decimal('80000.00'))
