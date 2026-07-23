"""
Net-Cash-Exposure Financial Model
=================================

Implements the flagship investor-grade financial engine reverse-engineered from
Synergy UK's internal "Don't Drink That!" workbook (see docs/DELIVERABLES_SPEC.md,
Archetype C). It produces the numbers that drive the investor deliverable:

    Gross Budget  −  Tax Rebate  =  Net Cash Exposure   (the investor hurdle)

and a 3-tier (Floor / Base / Breakout) revenue view that is measured against that
exposure to give coverage multiples, cash-on-cash, and break-even status.

The core is deliberately **pure Python** (Decimal only — no Django imports at module
level) so it can be unit-tested without a database. A thin adapter,
`build_from_budget()`, maps Django `Budget` line items onto the engine at the bottom
of the file.

Worked reference (Canary Islands, "Don't Drink That!"):
    Gross $4,145,000 → Eligible $2,535,000 → Rebate $1,246,266 (blended 49.2%)
    → Net Cash Exposure $2,898,734; revenue coverage 0.2x / 0.6x / 3.8x.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Iterable

# ─────────────────────────────────────────────────────────────────────────────
# Money helpers
# ─────────────────────────────────────────────────────────────────────────────

ZERO = Decimal("0")
CENTS = Decimal("0.01")
WHOLE = Decimal("1")


def _d(value) -> Decimal:
    """Coerce anything numeric-ish to Decimal safely (via str to avoid float noise)."""
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value or 0))


def money(value) -> Decimal:
    """Round to whole currency units (the workbook presents whole-dollar figures)."""
    return _d(value).quantize(WHOLE, rounding=ROUND_HALF_UP)


def pct(value) -> Decimal:
    return _d(value).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


# ─────────────────────────────────────────────────────────────────────────────
# Eligible-spend haircut engine
# ─────────────────────────────────────────────────────────────────────────────


class HaircutCategory(str, Enum):
    """Legislative eligibility categories and their qualifying haircut %.

    Values mirror the "Legislative Eligibility Category" column of the client's
    Budget Breakdown tab. `default_haircut()` returns the % of a line's spend that
    counts toward qualified spend for the rebate.
    """

    LOCAL_CREW = "Local Crew / Technical Staff"
    LOCAL_SERVICE = "Local Production Service Provider / Supplier"
    LOCAL_TRAVEL = "Local Travel / Accommodation / Catering"
    LOCAL_POST_VFX = "Local Post-Production / VFX Provider"
    PAYROLL_FRINGES = "Payroll Fringes on Eligible Staff"
    CREATIVE_STAFF_RESIDENT = "Creative Staff - Spain/EEA Tax Residency Confirmed"
    CREATIVE_STAFF_TBD = "Creative Staff - Residency TBD / Currently Excluded"
    RIGHTS_MUSIC = "Rights / Music License - Excluded Until Local Eligibility Confirmed"
    NON_ELIGIBLE = "Non-Eligible / Financing, Legal, Admin, Contingency"

    def default_haircut(self) -> Decimal:
        return _HAIRCUTS[self]


_HAIRCUTS: dict[HaircutCategory, Decimal] = {
    HaircutCategory.LOCAL_CREW: Decimal("100"),
    HaircutCategory.LOCAL_SERVICE: Decimal("100"),
    HaircutCategory.LOCAL_TRAVEL: Decimal("100"),
    HaircutCategory.LOCAL_POST_VFX: Decimal("100"),
    HaircutCategory.PAYROLL_FRINGES: Decimal("100"),
    HaircutCategory.CREATIVE_STAFF_RESIDENT: Decimal("100"),
    HaircutCategory.CREATIVE_STAFF_TBD: Decimal("0"),
    HaircutCategory.RIGHTS_MUSIC: Decimal("0"),
    HaircutCategory.NON_ELIGIBLE: Decimal("0"),
}


@dataclass
class BudgetLine:
    """A single budget line for eligibility purposes."""

    description: str
    amount: Decimal
    category: HaircutCategory
    # Optional per-line override of the category default (0–100).
    haircut_override: Decimal | None = None

    @property
    def haircut(self) -> Decimal:
        return self.haircut_override if self.haircut_override is not None else self.category.default_haircut()

    @property
    def eligible_amount(self) -> Decimal:
        return _d(self.amount) * (self.haircut / Decimal("100"))


def compute_eligible_spend(lines: Iterable[BudgetLine]) -> Decimal:
    """Sum eligible spend after applying each line's legislative haircut."""
    return sum((line.eligible_amount for line in lines), ZERO)


# ─────────────────────────────────────────────────────────────────────────────
# Incentive program (tiered rebate + FX + caps + thresholds)
# ─────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class IncentiveProgram:
    """A territory rebate program.

    Two modes:
    - **Tiered** (default = Canary Islands, Ley 27/2014 Art. 36.2): 54% on the
      first €1M of eligible spend, 45% above, computed in a law currency (EUR)
      via an FX rate, with an 80% cost cap and a €36M legal cap.
    - **Flat**: set `flat_rate` to a single percentage; tier fields are ignored,
      no FX conversion is applied (rebate is a straight % of eligible spend in the
      presentation currency). Used for every non-Canary territory whose incentive
      is a flat rebate on qualified spend.
    """

    name: str = "Canary Islands (Ley 27/2014 Art. 36.2)"
    currency: str = "EUR"                       # law currency
    flat_rate: Decimal | None = None            # set → flat-rate program (ignores tiers/FX)
    first_tier_ceiling: Decimal = Decimal("1000000")   # EUR
    first_tier_rate: Decimal = Decimal("54")           # % on first tier
    excess_rate: Decimal = Decimal("45")               # % above first tier
    conservative_flat_rate: Decimal = Decimal("45")    # downside scenario rate
    min_spend: Decimal = Decimal("1000000")            # min eligible spend threshold
    min_shoot_days: int = 14
    cost_cap_pct: Decimal = Decimal("80")              # eligible ≤ cost_cap_pct% of total cost
    legal_cap: Decimal | None = Decimal("36000000")    # max rebate per production (None = uncapped)


def flat_program(
    name: str,
    rate: Decimal,
    *,
    currency: str = "USD",
    min_spend: Decimal = ZERO,
    legal_cap: Decimal | None = None,
    min_shoot_days: int = 0,
) -> IncentiveProgram:
    """Build a flat-rate rebate program (rebate = rate% of eligible spend)."""
    rate = _d(rate)
    return IncentiveProgram(
        name=name,
        currency=currency,
        flat_rate=rate,
        conservative_flat_rate=max(ZERO, rate - Decimal("5")),  # downside = −5 pts
        min_spend=_d(min_spend),
        min_shoot_days=min_shoot_days,
        cost_cap_pct=Decimal("100"),   # no 80% cap for generic flat programs
        legal_cap=legal_cap,
    )


CANARY_ISLANDS = IncentiveProgram()  # tiered defaults


def program_from_territory(territory) -> tuple[IncentiveProgram, Decimal]:
    """Return (program, fx_rate) for a Django Territory.

    Canary Islands uses the tiered EUR program (with USD/EUR FX); every other
    territory uses a flat program in its own currency (fx = 1, rebate stays in the
    budget's currency, matching how the existing IncentiveEngine treats rebates).
    """
    code = getattr(territory, "country_code", "") or ""
    if code == "ES_CI":
        return CANARY_ISLANDS, Decimal("1.1724")

    rate = _d(getattr(territory, "base_percentage", 0))
    if getattr(territory, "is_stackable", False) and getattr(territory, "provincial_percentage", 0):
        rate += _d(territory.provincial_percentage)

    legal_cap = None
    if getattr(territory, "is_capped", False):
        legal_cap = getattr(territory, "max_rebate_cap", None)
        legal_cap = _d(legal_cap) if legal_cap is not None else None

    program = flat_program(
        name=f"{getattr(territory, 'name', 'Territory')} ({code})",
        rate=rate,
        currency=getattr(territory, "currency", "USD") or "USD",
        min_spend=_d(getattr(territory, "min_spend", 0) or 0),
        legal_cap=legal_cap,
    )
    return program, Decimal("1")


@dataclass
class IncentiveResult:
    gross_budget: Decimal            # presentation currency (e.g. USD)
    eligible_spend: Decimal          # presentation currency
    eligible_spend_law_ccy: Decimal  # law currency (e.g. EUR)
    rebate: Decimal                  # presentation currency
    rebate_law_ccy: Decimal          # law currency
    net_cash_exposure: Decimal       # gross − rebate (presentation currency)
    blended_rate: Decimal            # rebate / eligible spend, %
    eligible_of_gross: Decimal       # eligible / gross, %
    fx_rate: Decimal                 # presentation units per 1 law-currency unit
    first_tier_rebate_law_ccy: Decimal
    excess_rebate_law_ccy: Decimal
    compliance: dict
    capped_by_legal_cap: bool
    capped_by_cost_cap: bool

    def as_dict(self) -> dict:
        return {
            "gross_budget": float(self.gross_budget),
            "eligible_spend": float(self.eligible_spend),
            "eligible_spend_law_ccy": float(self.eligible_spend_law_ccy),
            "rebate": float(self.rebate),
            "rebate_law_ccy": float(self.rebate_law_ccy),
            "net_cash_exposure": float(self.net_cash_exposure),
            "blended_rate": float(self.blended_rate),
            "eligible_of_gross": float(self.eligible_of_gross),
            "fx_rate": float(self.fx_rate),
            "first_tier_rebate_law_ccy": float(self.first_tier_rebate_law_ccy),
            "excess_rebate_law_ccy": float(self.excess_rebate_law_ccy),
            "compliance": self.compliance,
            "capped_by_legal_cap": self.capped_by_legal_cap,
            "capped_by_cost_cap": self.capped_by_cost_cap,
        }


def _tiered_rebate(eligible_law_ccy: Decimal, program: IncentiveProgram) -> tuple[Decimal, Decimal, Decimal]:
    """Return (first_tier_rebate, excess_rebate, total) in law currency.

    For a flat-rate program the whole amount is a single "first-tier" rebate."""
    if program.flat_rate is not None:
        total = eligible_law_ccy * program.flat_rate / Decimal("100")
        return total, ZERO, total
    first_base = min(eligible_law_ccy, program.first_tier_ceiling)
    excess_base = max(ZERO, eligible_law_ccy - program.first_tier_ceiling)
    first_rebate = first_base * program.first_tier_rate / Decimal("100")
    excess_rebate = excess_base * program.excess_rate / Decimal("100")
    return first_rebate, excess_rebate, first_rebate + excess_rebate


def compute_incentive(
    gross_budget: Decimal,
    eligible_spend: Decimal,
    *,
    fx_rate: Decimal = Decimal("1.1724"),   # presentation units per 1 law-currency unit (USD per EUR)
    shoot_days: int = 25,
    program: IncentiveProgram | None = None,
) -> IncentiveResult:
    """Core rebate calculation.

    `fx_rate` is presentation-currency units per 1 unit of law currency (USD per EUR).
    `eligible_spend` is already haircut-adjusted, in presentation currency.
    Reproduces the workbook: $4,145,000 / $2,535,000 → rebate $1,246,266,
    net exposure $2,898,734, blended 49.2%.
    """
    program = program or IncentiveProgram()
    gross_budget = _d(gross_budget)
    eligible_spend = _d(eligible_spend)
    fx_rate = _d(fx_rate)

    # 80%-of-total-cost eligibility cap (applied in presentation currency).
    cost_cap_amount = gross_budget * program.cost_cap_pct / Decimal("100")
    capped_by_cost_cap = eligible_spend > cost_cap_amount
    approved_eligible = min(eligible_spend, cost_cap_amount)

    eligible_law = approved_eligible / fx_rate  # USD → EUR

    first_rebate, excess_rebate, rebate_law = _tiered_rebate(eligible_law, program)

    # Legal cap (law currency; None = uncapped).
    capped_by_legal_cap = program.legal_cap is not None and rebate_law > program.legal_cap
    if capped_by_legal_cap:
        rebate_law = program.legal_cap

    rebate = money(rebate_law * fx_rate)          # EUR → USD
    net_exposure = money(gross_budget - rebate)
    blended = (rebate / approved_eligible * Decimal("100")) if approved_eligible else ZERO
    elig_of_gross = (approved_eligible / gross_budget * Decimal("100")) if gross_budget else ZERO

    compliance = {
        "min_shoot_days": {
            "threshold": program.min_shoot_days,
            "value": shoot_days,
            "status": "PASS" if shoot_days >= program.min_shoot_days else "FAIL",
        },
        "min_local_spend": {
            "threshold": float(program.min_spend),
            "value": float(money(eligible_law)),
            "status": "PASS" if eligible_law >= program.min_spend else "FAIL",
        },
        "cost_cap": {
            "threshold": float(program.cost_cap_pct),
            "value": float(pct(elig_of_gross)),
            "status": "PASS" if not capped_by_cost_cap else "CAPPED",
        },
        "legal_cap": {
            "threshold": float(program.legal_cap) if program.legal_cap is not None else None,
            "value": float(money(rebate_law)),
            "status": "PASS" if not capped_by_legal_cap else "CAPPED",
        },
    }
    compliance["overall_status"] = (
        "PASS" if all(c["status"] == "PASS" for c in compliance.values() if isinstance(c, dict)) else "REVIEW"
    )

    return IncentiveResult(
        gross_budget=money(gross_budget),
        eligible_spend=money(approved_eligible),
        eligible_spend_law_ccy=money(eligible_law),
        rebate=rebate,
        rebate_law_ccy=money(rebate_law),
        net_cash_exposure=net_exposure,
        blended_rate=pct(blended),
        eligible_of_gross=pct(elig_of_gross),
        fx_rate=fx_rate,
        first_tier_rebate_law_ccy=money(first_rebate),
        excess_rebate_law_ccy=money(excess_rebate),
        compliance=compliance,
        capped_by_legal_cap=capped_by_legal_cap,
        capped_by_cost_cap=capped_by_cost_cap,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Revenue projection — Floor / Base / Breakout scenarios
# ─────────────────────────────────────────────────────────────────────────────

SCENARIOS = ("floor", "base", "breakout")


@dataclass
class RevenueWindow:
    """A single revenue window/region with per-scenario gross benchmark values."""

    name: str
    floor: Decimal = ZERO
    base: Decimal = ZERO
    breakout: Decimal = ZERO

    def value(self, scenario: str) -> Decimal:
        return _d(getattr(self, scenario))


# Reference window benchmarks for a ~$4.145M genre feature (from the workbook's
# Performance Estimator). Used to synthesise Floor/Base/Breakout revenue when a
# project has no bespoke sales estimates yet — scaled linearly by budget size.
# (title, floor, base, breakout) in USD.
_REFERENCE_WINDOWS: tuple[tuple[str, str, str, str], ...] = (
    ("US Theatrical (net to producer)", "35000", "300000", "3825000"),
    ("VOD — Netflix / Lead SVOD", "100000", "300000", "2500000"),
    ("VOD — Amazon / TVOD", "60000", "175000", "350000"),
    ("VOD — Apple / Premium Digital", "40000", "125000", "250000"),
    ("VOD — Hulu / Bundle", "25000", "75000", "150000"),
    ("VOD — Canal+ / EU Local", "25000", "75000", "150000"),
    ("UK / Ireland MG", "100000", "250000", "700000"),
    ("Germany MG", "100000", "250000", "700000"),
    ("France MG", "125000", "300000", "800000"),
    ("Italy MG", "75000", "200000", "600000"),
    ("Spain MG", "100000", "250000", "700000"),
    ("Airline / In-flight", "30000", "60000", "85000"),
    ("Global TV / PPV", "50000", "100000", "150000"),
)
_REFERENCE_BUDGET = Decimal("4145000")


def default_revenue_windows(gross_budget: Decimal) -> list["RevenueWindow"]:
    """Synthesise Floor/Base/Breakout windows for a project by scaling the reference
    $4.145M genre-feature benchmarks linearly by budget.

    This is a conservative, internally-consistent first estimate (net-to-producer
    theatrical across all scenarios) meant to be replaced by real sales-agent
    quotes. It is intentionally NOT an exact clone of the source workbook, which
    mixes net theatrical in Floor/Base with gross theatrical in the Breakout
    headline."""
    scale = _d(gross_budget) / _REFERENCE_BUDGET if gross_budget else ZERO
    windows: list[RevenueWindow] = []
    for name, floor, base, breakout in _REFERENCE_WINDOWS:
        windows.append(RevenueWindow(
            name=name,
            floor=money(_d(floor) * scale),
            base=money(_d(base) * scale),
            breakout=money(_d(breakout) * scale),
        ))
    return windows


@dataclass
class ScenarioResult:
    scenario: str
    worldwide_gross: Decimal
    distribution_haircut: Decimal
    net_project_revenue: Decimal
    net_cash_exposure: Decimal
    coverage_multiple: Decimal        # net revenue / net exposure
    cash_on_cash: Decimal             # net revenue − net exposure
    covers_exposure: bool

    def as_dict(self) -> dict:
        return {
            "scenario": self.scenario,
            "worldwide_gross": float(self.worldwide_gross),
            "distribution_haircut": float(self.distribution_haircut),
            "net_project_revenue": float(self.net_project_revenue),
            "net_cash_exposure": float(self.net_cash_exposure),
            "coverage_multiple": float(self.coverage_multiple),
            "cash_on_cash": float(self.cash_on_cash),
            "covers_exposure": self.covers_exposure,
        }


def project_revenue(
    windows: Iterable[RevenueWindow],
    net_cash_exposure: Decimal,
    *,
    distribution_haircut_pct: Decimal = Decimal("30"),
) -> dict[str, ScenarioResult]:
    """Aggregate windows into Floor/Base/Breakout scenarios, apply the distribution
    haircut, and measure each against the net cash exposure."""
    windows = list(windows)
    net_cash_exposure = _d(net_cash_exposure)
    haircut_rate = _d(distribution_haircut_pct) / Decimal("100")
    out: dict[str, ScenarioResult] = {}

    for scenario in SCENARIOS:
        gross = sum((w.value(scenario) for w in windows), ZERO)
        haircut = gross * haircut_rate
        net_rev = gross - haircut
        coverage = (net_rev / net_cash_exposure) if net_cash_exposure else ZERO
        out[scenario] = ScenarioResult(
            scenario=scenario,
            worldwide_gross=money(gross),
            distribution_haircut=money(haircut),
            net_project_revenue=money(net_rev),
            net_cash_exposure=money(net_cash_exposure),
            coverage_multiple=coverage.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP),
            cash_on_cash=money(net_rev - net_cash_exposure),
            covers_exposure=net_rev >= net_cash_exposure,
        )
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Budget sensitivity (overruns / rebate downside / no-incentive)
# ─────────────────────────────────────────────────────────────────────────────


def budget_sensitivity(
    gross_budget: Decimal,
    eligible_spend: Decimal,
    *,
    fx_rate: Decimal = Decimal("1.1724"),
    shoot_days: int = 25,
    program: IncentiveProgram | None = None,
) -> list[dict]:
    """Model the workbook's sensitivity grid: base, 5%/10% cost overrun,
    rebate-downside (flat 45%→ conservative), and no-incentive."""
    program = program or IncentiveProgram()
    gross_budget = _d(gross_budget)
    eligible_spend = _d(eligible_spend)
    rows: list[dict] = []

    def row(label, gross, elig, prog):
        r = compute_incentive(gross, elig, fx_rate=fx_rate, shoot_days=shoot_days, program=prog)
        return {
            "scenario": label,
            "gross_budget": float(r.gross_budget),
            "rebate": float(r.rebate),
            "net_cash_exposure": float(r.net_cash_exposure),
            "blended_rate": float(r.blended_rate),
        }

    rows.append(row("Base", gross_budget, eligible_spend, program))
    rows.append(row("5% Cost Overrun", gross_budget * Decimal("1.05"), eligible_spend, program))
    rows.append(row("10% Cost Overrun", gross_budget * Decimal("1.10"), eligible_spend, program))
    # Rebate downside — conservative rate.
    if program.flat_rate is not None:
        downside = flat_program(
            program.name + " (downside)",
            program.conservative_flat_rate,
            currency=program.currency,
            min_spend=program.min_spend,
            legal_cap=program.legal_cap,
            min_shoot_days=program.min_shoot_days,
        )
    else:
        downside = IncentiveProgram(
            name=program.name + " (downside)",
            first_tier_rate=program.conservative_flat_rate,
            excess_rate=program.conservative_flat_rate,
            first_tier_ceiling=program.first_tier_ceiling,
            min_spend=program.min_spend,
            min_shoot_days=program.min_shoot_days,
            cost_cap_pct=program.cost_cap_pct,
            legal_cap=program.legal_cap,
        )
    rows.append(row("Rebate Downside", gross_budget, eligible_spend, downside))
    # No incentive.
    rows.append({
        "scenario": "No Incentive",
        "gross_budget": float(money(gross_budget)),
        "rebate": 0.0,
        "net_cash_exposure": float(money(gross_budget)),
        "blended_rate": 0.0,
    })
    return rows


# ─────────────────────────────────────────────────────────────────────────────
# Top-level orchestration
# ─────────────────────────────────────────────────────────────────────────────


def build_financial_model(
    *,
    gross_budget: Decimal,
    eligible_lines: Iterable[BudgetLine] | None = None,
    eligible_spend: Decimal | None = None,
    windows: Iterable[RevenueWindow] | None = None,
    fx_rate: Decimal = Decimal("1.1724"),
    shoot_days: int = 25,
    distribution_haircut_pct: Decimal = Decimal("30"),
    program: IncentiveProgram | None = None,
    currency: str = "USD",
) -> dict:
    """Assemble the full model: incentive + net exposure + capital stack + revenue
    scenarios + sensitivity. Provide either `eligible_lines` (preferred — computes
    eligible spend via haircuts) or a pre-computed `eligible_spend`."""
    if eligible_spend is None:
        if eligible_lines is None:
            raise ValueError("Provide eligible_lines or eligible_spend")
        eligible_spend = compute_eligible_spend(eligible_lines)

    incentive = compute_incentive(
        gross_budget, eligible_spend, fx_rate=fx_rate, shoot_days=shoot_days, program=program
    )

    scenarios = (
        {k: v.as_dict() for k, v in project_revenue(
            windows, incentive.net_cash_exposure, distribution_haircut_pct=distribution_haircut_pct
        ).items()}
        if windows is not None else {}
    )

    gross = incentive.gross_budget
    rebate = incentive.rebate
    exposure = incentive.net_cash_exposure
    buffer_pct = pct(rebate / gross * Decimal("100")) if gross else ZERO

    return {
        "currency": currency,
        "incentive": incentive.as_dict(),
        "capital_stack": {
            "gross_budget": float(gross),
            "tax_shield": float(rebate),          # first-loss / bottom slice
            "net_cash_exposure": float(exposure),  # investor / top slice
            "buffer_pct": float(buffer_pct),       # ~30% government-backed buffer
            "investor_pct": float(pct(Decimal("100") - buffer_pct)),
        },
        "revenue_scenarios": scenarios,
        "sensitivity": budget_sensitivity(
            gross_budget, eligible_spend, fx_rate=fx_rate, shoot_days=shoot_days, program=program
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Django adapter — map a Budget's line items onto the engine
# ─────────────────────────────────────────────────────────────────────────────

# Keyword → HaircutCategory mapping for auto-classifying budget lines. Deliberately
# conservative: unknown/ATL creative lines default to residency-TBD (0%) until a
# producer confirms eligibility, matching the workbook's audit-ready stance.
_KEYWORD_CATEGORY_RULES = [
    # Order matters: the FIRST matching rule wins. More-specific rules go first,
    # and the ATL-creative (residency-sensitive) rule is checked before the broad
    # crew rule so e.g. "Lead Actor" is not caught by a crew token.
    (("fringe", "sag", "payroll"), HaircutCategory.PAYROLL_FRINGES),
    (("legal fee", "contingency", "overhead", "financing", "admin"), HaircutCategory.NON_ELIGIBLE),
    (("rights", "licence", "license"), HaircutCategory.RIGHTS_MUSIC),
    (("post", "editor", "vfx", "visual effects", "sound", "colorist", "color", " di ", "music", "composer", "foley", "adr", "grading"), HaircutCategory.LOCAL_POST_VFX),
    (("travel", "accommodation", "hotel", "catering", "craft service", "per diem", "lodging", "flights"), HaircutCategory.LOCAL_TRAVEL),
    # ATL creative (residency-sensitive) — must precede the crew rule.
    (("writer / director", "principal cast", "supporting cast", "lead actor", "actor", "cast"), HaircutCategory.CREATIVE_STAFF_TBD),
    # Below-the-line local crew / technical staff.
    (("line producer", "upm", "assistant director", "production coordinator", "production assistant",
      "production management", "crew", "grip", "gaffer", "electric", "camera operator",
      "camera assistant", "dp", "designer", "makeup", "hair", "costume", "wardrobe", "extras", "scout"), HaircutCategory.LOCAL_CREW),
    # Physical suppliers / services.
    (("location", "permit", "transport", "vehicle", "driver", "fuel", "equipment", "rental",
      "supplier", "insurance", "props", "set ", "art department", "sfx"), HaircutCategory.LOCAL_SERVICE),
    # Solo producer/director/writer lines (ATL creative) as a fallback.
    (("director", "producer", "writer"), HaircutCategory.CREATIVE_STAFF_TBD),
]


def classify_line(description: str, category: str = "", *, is_local_eligible: bool = False) -> HaircutCategory:
    """Best-effort classification of a budget line into a legislative category."""
    haystack = f"{description} {category}".lower()
    for keywords, cat in _KEYWORD_CATEGORY_RULES:
        if any(k in haystack for k in keywords):
            # An explicit local-eligible flag promotes residency-TBD creative to resident.
            if cat == HaircutCategory.CREATIVE_STAFF_TBD and is_local_eligible:
                return HaircutCategory.CREATIVE_STAFF_RESIDENT
            return cat
    return HaircutCategory.LOCAL_CREW if is_local_eligible else HaircutCategory.NON_ELIGIBLE


def budget_lines_from_django(budget) -> list[BudgetLine]:
    """Convert a Django Budget's line items into engine BudgetLine objects."""
    lines: list[BudgetLine] = []
    for item in budget.line_items.all():
        cat = classify_line(item.description, item.category or "", is_local_eligible=item.is_local_eligible)
        lines.append(BudgetLine(description=item.description, amount=_d(item.amount), category=cat))
    return lines


def build_from_budget(budget, *, territory=None, windows=None, fx_rate=None, program=None) -> dict:
    """Django entry point: build the full financial model from a saved Budget.

    If `territory` is given, the incentive program and FX are derived from it via
    `program_from_territory()` (Canary Islands → tiered EUR, otherwise flat in the
    territory's currency). Explicit `program`/`fx_rate` override the territory."""
    from django.db.models import Sum

    gross = budget.line_items.aggregate(total=Sum("amount"))["total"] or ZERO
    lines = budget_lines_from_django(budget)
    project = budget.project
    shoot_days = getattr(project, "shoot_duration_days", None) or 25
    currency = getattr(project, "currency", "USD") or "USD"

    if territory is not None and program is None:
        program, terr_fx = program_from_territory(territory)
        if fx_rate is None:
            fx_rate = terr_fx
    if fx_rate is None:
        fx_rate = Decimal("1.1724")

    if windows is None:
        windows = default_revenue_windows(gross)

    model = build_financial_model(
        gross_budget=gross,
        eligible_lines=lines,
        windows=windows,
        fx_rate=fx_rate,
        shoot_days=shoot_days,
        program=program,
        currency=currency,
    )
    model["program"] = {
        "name": (program or CANARY_ISLANDS).name,
        "mode": "flat" if (program and program.flat_rate is not None) else "tiered",
        "territory": getattr(territory, "name", None) if territory is not None else "Canary Islands",
    }
    return model
