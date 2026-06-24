import json
import logging
import urllib.request
import urllib.error
from decimal import Decimal

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from territories.models import Territory
from analysis.models import Analysis
from projects.models import Project

logger = logging.getLogger(__name__)

HF_API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3"


def _build_territory_context() -> str:
    """Summarize all active territories for the LLM prompt."""
    territories = Territory.objects.filter(status='ACTIVE').order_by('-base_percentage')[:16]
    lines = []
    for t in territories:
        pct = float(t.base_percentage)
        if t.is_stackable and t.provincial_percentage:
            pct += float(t.provincial_percentage)
        cap = f", cap {t.currency}{int(t.max_rebate_cap):,}" if t.is_capped and t.max_rebate_cap else ""
        timing = f"{t.rebate_timing_months_min}–{t.rebate_timing_months_max} months"
        lines.append(
            f"- {t.name} ({t.country_code}): {pct:.1f}% {t.incentive_type}{cap}, "
            f"timing {timing}, loan-against-rebate={'yes' if t.loan_against_rebate_available else 'no'}"
        )
    return "\n".join(lines)


def _build_analysis_context(user) -> str:
    """Include the user's most recent completed analysis if available."""
    analysis = (
        Analysis.objects.filter(project__created_by=user, status='COMPLETED')
        .order_by('-completed_at')
        .prefetch_related('results')
        .first()
    )
    if not analysis:
        return ""
    top = analysis.results.order_by('rank').first()
    if not top:
        return ""
    snap = analysis.finance_snapshot or {}
    parts = [
        f"\nUser's latest analysis — project: '{analysis.project_title}'",
        f"  Top territory: {top.territory_name} (rank 1), estimated rebate: "
        f"{top.currency}{float(top.estimated_rebate):,.0f} ({float(top.estimated_rebate_pct):.1f}%)",
        f"  Net benefit after logistics: {top.currency}{float(top.net_benefit):,.0f}",
    ]
    if snap:
        budget = snap.get('total_budget', 0)
        gap = snap.get('finance_gap', 0)
        parts.append(f"  Finance gap remaining: {snap.get('currency','')}{gap:,.0f} of {snap.get('currency','')}{budget:,.0f} budget")
    return "\n".join(parts)


def _call_hf(prompt: str, token: str, max_new_tokens: int = 512) -> str:
    payload = json.dumps({
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": max_new_tokens,
            "temperature": 0.4,
            "return_full_text": False,
        },
    }).encode()

    req = urllib.request.Request(
        HF_API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()
        logger.warning("HF API error %s: %s", exc.code, body)
        raise RuntimeError(f"HuggingFace returned {exc.code}: {body}") from exc

    if isinstance(data, list) and data:
        return data[0].get("generated_text", "").strip()
    if isinstance(data, dict):
        return data.get("generated_text", "").strip()
    return ""


SYSTEM_PROMPT = """You are Synergy Advisor, an expert AI assistant built into Synergy Net — a platform that helps film and TV producers maximise international co-production incentives. You have deep knowledge of film tax incentives, rebate schemes, production finance, and international co-production treaties.

Available territory incentives (today's data):
{territory_context}
{analysis_context}

Answer concisely and professionally. If a producer asks where to film, give a ranked recommendation with reasons. Always mention minimum spend thresholds, rebate timing, and financing implications. End every response with a one-line action item for the producer."""


class AdvisorView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        question = (request.data.get("question") or "").strip()
        if not question:
            return Response({"error": "question is required"}, status=status.HTTP_400_BAD_REQUEST)

        hf_token = getattr(settings, "HF_API_TOKEN", "")
        if not hf_token:
            return Response(
                {"error": "Synergy Advisor is not configured — HF_API_TOKEN missing."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        territory_ctx = _build_territory_context()
        analysis_ctx = _build_analysis_context(request.user)
        system = SYSTEM_PROMPT.format(
            territory_context=territory_ctx,
            analysis_context=analysis_ctx,
        )

        # Mistral instruction format
        prompt = f"<s>[INST] {system}\n\nProducer question: {question} [/INST]"

        try:
            answer = _call_hf(prompt, hf_token, max_new_tokens=600)
        except RuntimeError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        if not answer:
            return Response(
                {"error": "Model returned an empty response. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({"answer": answer})
