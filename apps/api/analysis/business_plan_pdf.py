"""
Full investor Business Plan PDF (Archetype A).

Composes the American-Odyssey-style investor business plan around the tested
Net-Cash-Exposure finance core: Story, Budget, Financing Plan, Cast, Schedule,
Financial Analysis (Floor/Base/Breakout + window build), Distribution &
Recoupment, Investment Returns, and Team. Everything money-related is sourced
from `financial_model.build_from_budget()`; narrative fields come from the
project's guided intake.
"""
import base64
from decimal import Decimal
from pathlib import Path

from django.template.loader import render_to_string
from django.conf import settings
from django.utils import timezone
from django.db.models import Sum


def _load_logo() -> str:
    for path in (
        Path(settings.BASE_DIR) / "reports" / "static" / "logo.jpg",
        Path(__file__).resolve().parent.parent / "reports" / "static" / "logo.jpg",
    ):
        try:
            return base64.b64encode(path.read_bytes()).decode()
        except OSError:
            continue
    return ""


# Standard theatrical→ancillary release cascade (from the reference plans). Static
# because it is industry-standard timing, not project-specific.
RECOUPMENT_WINDOWS = [
    ("US Theatrical", "Initial release"),
    ("International Theatrical", "0–3 months after release"),
    ("Domestic Streaming (SVOD/AVOD)", "3–6 months"),
    ("Foreign Streaming (SVOD/AVOD)", "3–6 months"),
    ("Pay-Per-View (Amazon, Apple)", "3–6 months"),
    ("Home Video (DVD/Blu-ray)", "3–6 months"),
    ("Airline / In-flight", "3–9 months"),
    ("US Pay TV", "6–9 months"),
    ("International Video", "6–12 months"),
    ("US Basic Cable", "12–15 months"),
    ("US & International Free TV", "24–36 months"),
]

# Standard investor waterfall terms (mirrors the reference business plans).
RETURNS_TERMS = {
    "recoup_multiple": "120%",
    "profit_split_investor": "50%",
    "profit_split_other": "50%",
}


def _budget_breakdown(budget, gross: Decimal) -> list[dict]:
    """Group budget line items into ATL / Production / Post / Other with % of gross."""
    buckets = {"Above the Line": Decimal("0"), "Production": Decimal("0"),
               "Post-Production": Decimal("0"), "Other / Contingency": Decimal("0")}
    post_kw = ("post", "editor", "vfx", "visual effect", "sound", "music", "composer", "color", " di")
    other_kw = ("legal", "contingency", "overhead", "insurance", "financing", "admin")
    for item in budget.line_items.all():
        amt = Decimal(str(item.amount or 0))
        hay = f"{item.description} {item.category or ''}".lower()
        if getattr(item, "is_above_the_line", False):
            buckets["Above the Line"] += amt
        elif any(k in hay for k in post_kw):
            buckets["Post-Production"] += amt
        elif any(k in hay for k in other_kw):
            buckets["Other / Contingency"] += amt
        else:
            buckets["Production"] += amt
    gross = gross or Decimal("1")
    return [
        {"name": name, "amount": float(amt), "pct": float((amt / gross * 100).quantize(Decimal("0.1")))}
        for name, amt in buckets.items() if amt > 0
    ]


def _cast(project) -> list[dict]:
    info = getattr(project, "cast_crew_info", None) or {}
    out: list[dict] = []
    if isinstance(info, dict):
        cast = info.get("cast") or info.get("principal") or []
        if isinstance(cast, list):
            for c in cast:
                if isinstance(c, dict):
                    out.append({"role": c.get("role") or c.get("character") or "", "name": c.get("name") or "", "status": c.get("status", "")})
                elif isinstance(c, str):
                    out.append({"role": "", "name": c, "status": ""})
        if not out:
            for k, v in info.items():
                if isinstance(v, str):
                    out.append({"role": k, "name": v, "status": ""})
    elif isinstance(info, list):
        for c in info:
            if isinstance(c, dict):
                out.append({"role": c.get("role", ""), "name": c.get("name", ""), "status": c.get("status", "")})
    return out


def _timeline(project) -> list[dict]:
    tl = getattr(project, "production_timeline", None) or {}
    if isinstance(tl, dict):
        return [{"milestone": k, "date": v} for k, v in tl.items()]
    if isinstance(tl, list):
        out = []
        for row in tl:
            if isinstance(row, dict):
                out.append({"milestone": row.get("milestone", ""), "date": row.get("date", "")})
        return out
    return []


class BusinessPlanPDF:
    def __init__(self, model: dict, project, budget):
        self.model = model
        self.project = project
        self.budget = budget

    def _context(self) -> dict:
        m = self.model
        gross = self.budget.line_items.aggregate(t=Sum("amount"))["t"] or Decimal("0")
        scenarios = m.get("revenue_scenarios", {})
        producer = getattr(self.project, "producer", None)
        return {
            "project": self.project,
            "producer": producer,
            "company": getattr(producer, "company_name", "") if producer else "",
            "currency": m.get("currency", "USD"),
            "program": m.get("program", {}),
            "incentive": m.get("incentive", {}),
            "capital_stack": m.get("capital_stack", {}),
            "scenarios": [scenarios[k] for k in ("floor", "base", "breakout") if k in scenarios],
            "revenue_windows": m.get("revenue_windows", []),
            "budget_breakdown": _budget_breakdown(self.budget, Decimal(str(gross))),
            "financing_sources": [
                {"name": "Tax Incentive Receivable", "amount": m.get("capital_stack", {}).get("tax_shield", 0)},
                {"name": "Equity / Cash Requirement", "amount": m.get("capital_stack", {}).get("net_cash_exposure", 0)},
            ],
            "distribution_haircut_pct": m.get("distribution_haircut_pct", 30),
            "cast": _cast(self.project),
            "timeline": _timeline(self.project),
            "recoupment_windows": RECOUPMENT_WINDOWS,
            "returns": RETURNS_TERMS,
            "generated_at": timezone.now(),
            "year": timezone.now().year,
            "logo_data": _load_logo(),
        }

    def generate(self) -> bytes:
        html_string = render_to_string("analysis/business_plan.html", self._context())
        try:
            from weasyprint import HTML
        except ImportError as exc:  # pragma: no cover - production has WeasyPrint
            raise RuntimeError(
                "PDF generation requires WeasyPrint and its native system dependencies."
            ) from exc
        return HTML(string=html_string, base_url=str(settings.BASE_DIR)).write_pdf()
