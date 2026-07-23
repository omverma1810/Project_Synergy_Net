import logging

import requests as _requests

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from territories.models import Territory
from analysis.models import Analysis
from analysis.insights import build_finance_snapshot

logger = logging.getLogger(__name__)

# HuggingFace's OpenAI-compatible chat completions router. The legacy
# api-inference.huggingface.co / hf-inference text-generation endpoints were
# retired, and small chat models are now served through inference providers
# behind this single endpoint.
HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions"

# Tried in order — routing picks whichever inference provider currently hosts
# the model, so this survives individual providers dropping a model.
CHAT_MODELS = [
    "meta-llama/Llama-3.1-8B-Instruct",
    "mistralai/Mistral-7B-Instruct-v0.3",
    "Qwen/Qwen2.5-7B-Instruct",
]


def _build_territory_context() -> str:
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
    # Project FK is named `producer` not `created_by`
    analysis = (
        Analysis.objects.filter(project__producer=user, status='COMPLETED')
        .order_by('-completed_at')
        .prefetch_related('results')
        .first()
    )
    if not analysis:
        return ""
    top = analysis.results.order_by('rank').first()
    if not top:
        return ""
    # finance_snapshot is a computed value, not a DB field
    try:
        snap = build_finance_snapshot(analysis) or {}
    except Exception:
        snap = {}
    parts = [
        f"\nUser's latest analysis — project: '{analysis.project.title}'",
        f"  Top territory: {top.territory_name} (rank 1), estimated rebate: "
        f"{top.currency}{float(top.estimated_rebate):,.0f} ({float(top.estimated_rebate_pct):.1f}%)",
        f"  Net benefit after logistics: {top.currency}{float(top.net_benefit):,.0f}",
    ]
    if snap:
        budget = snap.get('total_budget', 0)
        gap = snap.get('finance_gap', 0)
        currency = snap.get('currency', '')
        parts.append(f"  Finance gap remaining: {currency}{gap:,.0f} of {currency}{budget:,.0f} budget")
    return "\n".join(parts)


SYSTEM_PROMPT = """You are Akira, the expert AI production finance advisor inside Synergy Net, a Synergy Media Labs platform helping film and TV producers maximise international co-production incentives. You have deep knowledge of film tax incentives, rebate schemes, production finance, and co-production treaties.

Available territory incentives (live data):
{territory_context}
{analysis_context}

Instructions: Answer concisely and professionally. Introduce yourself as Akira if greeted. When asked where to film, give a ranked recommendation with specific reasons. Always cite rebate %, minimum spend thresholds, payout timing, and financing impact. End with a one-line action item for the producer."""


def _call_chat(model: str, system_prompt: str, question: str, token: str, max_tokens: int = 700) -> str:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.4,
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    try:
        resp = _requests.post(HF_CHAT_URL, json=payload, headers=headers, timeout=60)
    except _requests.exceptions.RequestException as exc:
        logger.warning("HF network error for %s: %s", model, exc)
        raise RuntimeError(f"Network error reaching the AI service: {exc}") from exc

    if not resp.ok:
        logger.warning("HF chat error %s for %s: %s", resp.status_code, model, resp.text[:300])
        raise RuntimeError(f"AI service error {resp.status_code} for {model}.")

    data = resp.json()
    choices = data.get("choices") or []
    if not choices:
        return ""
    return (choices[0].get("message", {}).get("content") or "").strip()


class AdvisorView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        question = (request.data.get("question") or "").strip()
        if not question:
            return Response({"detail": "question is required"}, status=status.HTTP_400_BAD_REQUEST)

        hf_token = getattr(settings, "HF_API_TOKEN", "")
        if not hf_token:
            return Response(
                {"detail": "Akira is not yet configured. The HF_API_TOKEN secret needs to be set in GCP."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        territory_ctx = _build_territory_context()
        analysis_ctx = _build_analysis_context(request.user)
        system_prompt = SYSTEM_PROMPT.format(
            territory_context=territory_ctx,
            analysis_context=analysis_ctx,
        )

        answer = ""
        last_error = ""
        for model in CHAT_MODELS:
            try:
                answer = _call_chat(model, system_prompt, question, hf_token)
                if answer:
                    break
            except RuntimeError as exc:
                last_error = str(exc)
                logger.warning("Model %s failed: %s — trying next", model, exc)

        if not answer:
            return Response(
                {"detail": last_error or "Akira returned an empty response. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({"answer": answer})
