"""
Unit tests for the Net-Cash-Exposure financial engine (analysis/financial_model.py).

These are pure-Python (no Django/DB) and pin the engine to the client's worked
reference workbook "Don't Drink That!":
    Gross $4,145,000 → Eligible $2,535,000 → Rebate $1,246,266 (blended 49.2%)
    → Net Cash Exposure $2,898,734; revenue coverage 0.2x / 0.6x / 3.8x.

Run standalone:  python -m unittest analysis.tests.test_financial_model
"""
import unittest
from decimal import Decimal
from types import SimpleNamespace

from analysis.financial_model import (
    BudgetLine,
    HaircutCategory,
    IncentiveProgram,
    RevenueWindow,
    budget_lines_from_django,
    build_financial_model,
    budget_sensitivity,
    classify_line,
    compute_eligible_spend,
    compute_incentive,
    default_revenue_windows,
    flat_program,
    program_from_territory,
    project_revenue,
)


def _fake_line(description, amount, category="", is_local_eligible=False):
    return SimpleNamespace(description=description, amount=Decimal(str(amount)), category=category, is_local_eligible=is_local_eligible)


def _fake_budget(lines, residency_confirmed=False):
    project = SimpleNamespace(creative_staff_local_resident=residency_confirmed)
    return SimpleNamespace(project=project, line_items=SimpleNamespace(all=lambda: lines))

GROSS = Decimal("4145000")
ELIGIBLE = Decimal("2535000")
FX = Decimal("1.1724")  # USD per EUR


class IncentiveMathTests(unittest.TestCase):
    def test_worked_example_rebate_and_exposure(self):
        r = compute_incentive(GROSS, ELIGIBLE, fx_rate=FX, shoot_days=25)
        # Rebate and net exposure must match the workbook to the dollar.
        self.assertEqual(r.rebate, Decimal("1246266"))
        self.assertEqual(r.net_cash_exposure, Decimal("2898734"))

    def test_eligible_converted_to_eur(self):
        r = compute_incentive(GROSS, ELIGIBLE, fx_rate=FX)
        # €2,162,231 per the workbook (whole-euro).
        self.assertEqual(r.eligible_spend_law_ccy, Decimal("2162231"))

    def test_tiered_split_54_45(self):
        r = compute_incentive(GROSS, ELIGIBLE, fx_rate=FX)
        # First €1M @ 54% = €540,000; remainder @ 45% = €523,004.
        self.assertEqual(r.first_tier_rebate_law_ccy, Decimal("540000"))
        self.assertEqual(r.excess_rebate_law_ccy, Decimal("523004"))

    def test_blended_rate_and_coverage_ratios(self):
        r = compute_incentive(GROSS, ELIGIBLE, fx_rate=FX)
        self.assertEqual(r.blended_rate, Decimal("49.2"))
        self.assertEqual(r.eligible_of_gross, Decimal("61.2"))

    def test_compliance_all_pass(self):
        r = compute_incentive(GROSS, ELIGIBLE, fx_rate=FX, shoot_days=25)
        self.assertEqual(r.compliance["min_shoot_days"]["status"], "PASS")
        self.assertEqual(r.compliance["min_local_spend"]["status"], "PASS")
        self.assertEqual(r.compliance["cost_cap"]["status"], "PASS")
        self.assertEqual(r.compliance["legal_cap"]["status"], "PASS")

    def test_min_shoot_days_fail(self):
        r = compute_incentive(GROSS, ELIGIBLE, fx_rate=FX, shoot_days=10)
        self.assertEqual(r.compliance["min_shoot_days"]["status"], "FAIL")

    def test_cost_cap_limits_eligible(self):
        # Eligible above 80% of gross must be capped to 80%.
        huge_eligible = GROSS  # 100% of gross
        r = compute_incentive(GROSS, huge_eligible, fx_rate=FX)
        self.assertTrue(r.capped_by_cost_cap)
        self.assertEqual(r.eligible_spend, Decimal("3316000"))  # 80% of 4,145,000


class HaircutEngineTests(unittest.TestCase):
    def test_haircut_categories(self):
        lines = [
            BudgetLine("Local Gaffer", Decimal("70000"), HaircutCategory.LOCAL_CREW),          # 100%
            BudgetLine("Principal Cast (TBD residency)", Decimal("800000"), HaircutCategory.CREATIVE_STAFF_TBD),  # 0%
            BudgetLine("Contingency", Decimal("250000"), HaircutCategory.NON_ELIGIBLE),          # 0%
            BudgetLine("Resident Writer", Decimal("150000"), HaircutCategory.CREATIVE_STAFF_RESIDENT),  # 100%
        ]
        # Only the local crew + resident writer qualify: 70,000 + 150,000.
        self.assertEqual(compute_eligible_spend(lines), Decimal("220000"))

    def test_haircut_override(self):
        line = BudgetLine("Partial", Decimal("100000"), HaircutCategory.LOCAL_CREW, haircut_override=Decimal("50"))
        self.assertEqual(line.eligible_amount, Decimal("50000"))

    def test_classify_line_keywords(self):
        self.assertEqual(classify_line("Local Gaffer / Electric Team"), HaircutCategory.LOCAL_CREW)
        self.assertEqual(classify_line("Contingency"), HaircutCategory.NON_ELIGIBLE)
        self.assertEqual(classify_line("Editor"), HaircutCategory.LOCAL_POST_VFX)
        self.assertEqual(classify_line("Hotels / Housing"), HaircutCategory.LOCAL_TRAVEL)
        # Cast defaults to residency-TBD (excluded) unless flagged local-eligible.
        self.assertEqual(classify_line("Lead Actor"), HaircutCategory.CREATIVE_STAFF_TBD)
        self.assertEqual(
            classify_line("Lead Actor", is_local_eligible=True),
            HaircutCategory.CREATIVE_STAFF_RESIDENT,
        )


class ResidencyOverrideTests(unittest.TestCase):
    def test_residency_unconfirmed_excludes_creative_staff(self):
        budget = _fake_budget([
            _fake_line("Lead Actor", 800000),
            _fake_line("Local Gaffer", 70000),
        ], residency_confirmed=False)
        lines = budget_lines_from_django(budget)
        self.assertEqual(compute_eligible_spend(lines), Decimal("70000"))  # only the crew line

    def test_residency_confirmed_includes_creative_staff(self):
        budget = _fake_budget([
            _fake_line("Lead Actor", 800000),
            _fake_line("Local Gaffer", 70000),
        ], residency_confirmed=True)
        lines = budget_lines_from_django(budget)
        self.assertEqual(compute_eligible_spend(lines), Decimal("870000"))  # both now eligible

    def test_residency_confirmed_does_not_widen_non_creative_lines(self):
        # Unmatched/non-eligible categories must stay excluded regardless of the
        # project-level residency flag -- only CREATIVE_STAFF_TBD is affected.
        budget = _fake_budget([
            _fake_line("Contingency", 250000),
            _fake_line("Some Unrecognised Line Item", 10000),
        ], residency_confirmed=True)
        lines = budget_lines_from_django(budget)
        self.assertEqual(compute_eligible_spend(lines), Decimal("0"))

    def test_explicit_local_eligible_flag_still_works_without_residency(self):
        budget = _fake_budget([
            _fake_line("Lead Actor", 800000, is_local_eligible=True),
        ], residency_confirmed=False)
        lines = budget_lines_from_django(budget)
        self.assertEqual(compute_eligible_spend(lines), Decimal("800000"))


class RevenueScenarioTests(unittest.TestCase):
    def _windows(self):
        # Aggregate window totals from the workbook's Performance Estimator.
        return [
            RevenueWindow("US Theatrical (net)", Decimal("35000"), Decimal("300000"), Decimal("3825000")),
            RevenueWindow("VOD Bundle", Decimal("250000"), Decimal("750000"), Decimal("3400000")),
            RevenueWindow("Territorial MGs", Decimal("500000"), Decimal("1250000"), Decimal("4300000")),
            RevenueWindow("Airline", Decimal("30000"), Decimal("60000"), Decimal("85000")),
            RevenueWindow("Global TV / PPV", Decimal("50000"), Decimal("100000"), Decimal("150000")),
            RevenueWindow("UK/Ireland MG", Decimal("0"), Decimal("0"), Decimal("3875000")),
        ]

    def test_coverage_multiples(self):
        # Build windows that sum to the workbook scenario grosses precisely.
        windows = [
            RevenueWindow("All windows", Decimal("865000"), Decimal("2460000"), Decimal("15635000")),
        ]
        res = project_revenue(windows, Decimal("2898734"), distribution_haircut_pct=Decimal("30"))
        self.assertEqual(res["floor"].worldwide_gross, Decimal("865000"))
        self.assertEqual(res["floor"].net_project_revenue, Decimal("605500"))
        self.assertEqual(res["floor"].coverage_multiple, Decimal("0.2"))
        self.assertEqual(res["base"].net_project_revenue, Decimal("1722000"))
        self.assertEqual(res["base"].coverage_multiple, Decimal("0.6"))
        self.assertEqual(res["breakout"].net_project_revenue, Decimal("10944500"))
        self.assertEqual(res["breakout"].coverage_multiple, Decimal("3.8"))
        self.assertTrue(res["breakout"].covers_exposure)
        self.assertFalse(res["floor"].covers_exposure)

    def test_distribution_haircut_is_30pct(self):
        windows = [RevenueWindow("x", Decimal("1000000"), Decimal("1000000"), Decimal("1000000"))]
        res = project_revenue(windows, Decimal("500000"))
        self.assertEqual(res["base"].distribution_haircut, Decimal("300000"))
        self.assertEqual(res["base"].net_project_revenue, Decimal("700000"))


class SensitivityTests(unittest.TestCase):
    def test_sensitivity_grid(self):
        rows = budget_sensitivity(GROSS, ELIGIBLE, fx_rate=FX)
        labels = [r["scenario"] for r in rows]
        self.assertEqual(labels, ["Base", "5% Cost Overrun", "10% Cost Overrun", "Rebate Downside", "No Incentive"])
        base = rows[0]
        self.assertEqual(base["net_cash_exposure"], 2898734.0)
        # No-incentive: exposure equals full gross.
        self.assertEqual(rows[-1]["net_cash_exposure"], 4145000.0)
        self.assertEqual(rows[-1]["rebate"], 0.0)
        # Overruns raise exposure.
        self.assertGreater(rows[1]["net_cash_exposure"], base["net_cash_exposure"])


class DefaultWindowsTests(unittest.TestCase):
    def test_scales_linearly_with_budget(self):
        w1 = default_revenue_windows(Decimal("4145000"))
        w2 = default_revenue_windows(Decimal("8290000"))  # 2x budget
        base1 = sum((w.base for w in w1), Decimal("0"))
        base2 = sum((w.base for w in w2), Decimal("0"))
        # Doubling the budget doubles the benchmark revenue.
        self.assertEqual(base2, base1 * 2)

    def test_three_tiers_present_and_ordered(self):
        windows = default_revenue_windows(Decimal("4145000"))
        self.assertTrue(windows)
        for w in windows:
            self.assertLessEqual(w.floor, w.base)
            self.assertLessEqual(w.base, w.breakout)


class FlatProgramTests(unittest.TestCase):
    def test_flat_rebate_no_fx(self):
        prog = flat_program("UK AVEC", Decimal("25.5"), currency="GBP")
        r = compute_incentive(Decimal("2000000"), Decimal("1000000"), fx_rate=Decimal("1"), program=prog)
        # 25.5% of 1,000,000 = 255,000; net = 2,000,000 − 255,000.
        self.assertEqual(r.rebate, Decimal("255000"))
        self.assertEqual(r.net_cash_exposure, Decimal("1745000"))
        self.assertEqual(r.blended_rate, Decimal("25.5"))

    def test_flat_program_legal_cap(self):
        prog = flat_program("Capped", Decimal("30"), legal_cap=Decimal("100000"))
        r = compute_incentive(Decimal("2000000"), Decimal("1000000"), fx_rate=Decimal("1"), program=prog)
        # 30% of 1M = 300,000 but capped at 100,000.
        self.assertEqual(r.rebate, Decimal("100000"))
        self.assertTrue(r.capped_by_legal_cap)

    def test_flat_program_no_cost_cap(self):
        # Flat programs use cost_cap_pct=100 → eligible up to 100% of gross allowed.
        prog = flat_program("NoCap", Decimal("40"))
        r = compute_incentive(Decimal("1000000"), Decimal("1000000"), fx_rate=Decimal("1"), program=prog)
        self.assertFalse(r.capped_by_cost_cap)
        self.assertEqual(r.eligible_spend, Decimal("1000000"))

    def test_program_from_territory_flat(self):
        terr = SimpleNamespace(
            country_code="GB", name="UK AVEC", base_percentage=Decimal("25.5"),
            provincial_percentage=Decimal("0"), is_stackable=False,
            is_capped=False, max_rebate_cap=None, currency="GBP", min_spend=Decimal("1000000"),
        )
        prog, fx = program_from_territory(terr)
        self.assertEqual(fx, Decimal("1"))
        self.assertIsNotNone(prog.flat_rate)
        self.assertEqual(prog.flat_rate, Decimal("25.5"))

    def test_program_from_territory_stacking(self):
        terr = SimpleNamespace(
            country_code="CA_BC", name="BC", base_percentage=Decimal("16"),
            provincial_percentage=Decimal("35"), is_stackable=True,
            is_capped=False, max_rebate_cap=None, currency="CAD", min_spend=Decimal("0"),
        )
        prog, _ = program_from_territory(terr)
        self.assertEqual(prog.flat_rate, Decimal("51"))  # 16 + 35 stacked

    def test_program_from_territory_canary_is_tiered(self):
        terr = SimpleNamespace(country_code="ES_CI", name="Canary Islands")
        prog, fx = program_from_territory(terr)
        self.assertIsNone(prog.flat_rate)          # tiered
        self.assertEqual(fx, Decimal("1.1724"))


class FullModelTests(unittest.TestCase):
    def test_build_financial_model_capital_stack(self):
        model = build_financial_model(
            gross_budget=GROSS,
            eligible_spend=ELIGIBLE,
            windows=[RevenueWindow("all", Decimal("865000"), Decimal("2460000"), Decimal("15635000"))],
            fx_rate=FX,
        )
        cs = model["capital_stack"]
        self.assertEqual(cs["gross_budget"], 4145000.0)
        self.assertEqual(cs["tax_shield"], 1246266.0)
        self.assertEqual(cs["net_cash_exposure"], 2898734.0)
        # ~30% government-backed buffer.
        self.assertAlmostEqual(cs["buffer_pct"], 30.1, delta=0.2)
        self.assertIn("breakout", model["revenue_scenarios"])


if __name__ == "__main__":
    unittest.main()
