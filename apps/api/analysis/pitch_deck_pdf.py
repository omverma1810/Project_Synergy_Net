"""
Visual investor Pitch Deck PDF (Archetype B).

A landscape, slide-style creative deck modelled on the "First Christmas" reference:
title/poster, logline + specs, synopsis, cast (with attachment status), tone
comparables, a light finance "ask" slide (tied to the Net-Cash-Exposure model),
and a closing contact slide. Complements the finance-heavy Business Plan (A).
"""
import base64
from decimal import Decimal
from pathlib import Path

from django.template.loader import render_to_string
from django.conf import settings
from django.utils import timezone

from .business_plan_pdf import _cast, _load_logo


# Tonal reference films by genre — used for the "Film Tone Comparables" slide.
# Titles only (no financials): standard pitch-deck practice, nothing fabricated.
TONE_COMPARABLES = {
    "drama": ["The Holdovers", "Manchester by the Sea", "Brooklyn"],
    "comedy": ["About a Boy", "Sing Street", "The Holdovers"],
    "thriller": ["Prisoners", "Wind River", "A Simple Favor"],
    "horror": ["Hereditary", "The Witch", "It Follows"],
    "action": ["Sicario", "Nightcrawler", "Hell or High Water"],
    "sci_fi": ["Ex Machina", "Arrival", "Moon"],
    "documentary": ["Free Solo", "Icarus", "20 Feet from Stardom"],
    "animation": ["Wolfwalkers", "The Breadwinner", "I Lost My Body"],
    "romance": ["Past Lives", "Carol", "The Big Sick"],
    "streaming": ["The Holdovers", "Marriage Story", "Minari"],
}
DEFAULT_COMPARABLES = ["The Holdovers", "Minari", "Brooklyn"]


class PitchDeckPDF:
    def __init__(self, model: dict, project):
        self.model = model
        self.project = project

    def _context(self) -> dict:
        m = self.model
        producer = getattr(self.project, "producer", None)
        genre = (getattr(self.project, "genre", "") or "").lower()
        return {
            "project": self.project,
            "producer": producer,
            "company": getattr(producer, "company_name", "") if producer else "",
            "currency": m.get("currency", "USD"),
            "program": m.get("program", {}),
            "capital_stack": m.get("capital_stack", {}),
            "incentive": m.get("incentive", {}),
            "cast": _cast(self.project),
            "comparables": TONE_COMPARABLES.get(genre, DEFAULT_COMPARABLES),
            "generated_at": timezone.now(),
            "year": timezone.now().year,
            "logo_data": _load_logo(),
        }

    def generate(self) -> bytes:
        html_string = render_to_string("analysis/pitch_deck.html", self._context())
        try:
            from weasyprint import HTML
        except ImportError as exc:  # pragma: no cover - production has WeasyPrint
            raise RuntimeError(
                "PDF generation requires WeasyPrint and its native system dependencies."
            ) from exc
        return HTML(string=html_string, base_url=str(settings.BASE_DIR)).write_pdf()
