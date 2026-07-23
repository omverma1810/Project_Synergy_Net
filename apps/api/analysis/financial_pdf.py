"""
Branded PDF renderer for the Net-Cash-Exposure financial model (Archetype C).

Turns the dict produced by `financial_model.build_from_budget()` into an
investor-facing PDF that mirrors the key tabs of the client's "Don't Drink That!"
workbook: Investor Snapshot, Incentive Calculation, Revenue Scenarios, and Budget
Sensitivity. Rendering uses WeasyPrint (already a production dependency).
"""
import base64
from pathlib import Path

from django.template.loader import render_to_string
from django.conf import settings
from django.utils import timezone


def _load_logo() -> str:
    """Base64-encode the Synergy Media Labs logo (shared with reports/)."""
    candidates = [
        Path(settings.BASE_DIR) / "reports" / "static" / "logo.jpg",
        Path(__file__).resolve().parent.parent / "reports" / "static" / "logo.jpg",
    ]
    for path in candidates:
        try:
            return base64.b64encode(path.read_bytes()).decode()
        except OSError:
            continue
    return ""


class FinancialModelPDF:
    """Render a financial-model dict + project into a branded PDF (bytes)."""

    def __init__(self, model: dict, project):
        self.model = model
        self.project = project

    def _context(self) -> dict:
        m = self.model
        scenarios = m.get("revenue_scenarios", {})
        return {
            "project": self.project,
            "currency": m.get("currency", "USD"),
            "program": m.get("program", {}),
            "incentive": m.get("incentive", {}),
            "capital_stack": m.get("capital_stack", {}),
            "scenarios": [scenarios[k] for k in ("floor", "base", "breakout") if k in scenarios],
            "sensitivity": m.get("sensitivity", []),
            "compliance": (m.get("incentive", {}) or {}).get("compliance", {}),
            "generated_at": timezone.now(),
            "year": timezone.now().year,
            "logo_data": _load_logo(),
        }

    def generate(self) -> bytes:
        html_string = render_to_string("analysis/financial_model_report.html", self._context())
        try:
            from weasyprint import HTML
        except ImportError as exc:  # pragma: no cover - production has WeasyPrint
            raise RuntimeError(
                "PDF generation requires WeasyPrint and its native system dependencies."
            ) from exc
        return HTML(string=html_string, base_url=str(settings.BASE_DIR)).write_pdf()
