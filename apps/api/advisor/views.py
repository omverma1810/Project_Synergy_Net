import json
import logging
import time
import urllib.request
import urllib.error

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from territories.models import Territory
from analysis.models import Analysis
from analysis.insights import build_finance_snapshot

logger = logging.getLogger(__name__)

# Zephyr-7B-beta is freely accessible on HF Inference API with no gating.
# Mistral v0.2 is the fallback (requires HF login but no gated approval).
HF_API_URL = "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta"
HF_FALLBACK_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2"


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


def _call_hf(url: str, prompt: str, token: str, max_new_tokens: int = 512) -> str:
    payload = json.dumps({
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": max_new_tokens,
            "temperature": 0.4,
            "return_full_text": False,
        },
    }).encode()

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()
        logger.warning("HF API error %s: %s", exc.code, body)

        # 503 = model is loading; wait and retry once
        if exc.code == 503:
            try:
                body_json = json.loads(body)
                wait = min(float(body_json.get("estimated_time", 20)), 30)
            except Exception:
                wait = 20
            logger.info("HF model loading, waiting %.0fs then retrying", wait)
            time.sleep(wait)
            try:
                with urllib.request.urlopen(req, timeout=60) as resp2:
                    data = json.loads(resp2.read().decode())
            except urllib.error.HTTPError as exc2:
                raise RuntimeError(f"Model still loading after retry ({exc2.code}). Try again in 30 seconds.") from exc2
        else:
            raise RuntimeError(f"HuggingFace API error {exc.code}. Please try again.") from exc

    if isinstance(data, list) and data:
        return (data[0].get("generated_text") or "").strip()
    if isinstance(data, dict):
        return (data.get("generated_text") or "").strip()
    return ""


SYSTEM_PROMPT = """<|system|>
You are Synergy Advisor, an expert AI assistant inside Synergy Net — a platform helping film and TV producers maximise international co-production incentives. You have deep knowledge of film tax incentives, rebate schemes, production finance, and co-production treaties.

Available territory incentives (live data):
{territory_context}
{analysis_context}

Instructions: Answer concisely and professionally. When asked where to film, give a ranked recommendation with specific reasons. Always cite rebate %, minimum spend thresholds, payout timing, and financing impact. End with a one-line action item for the producer.</s>
<|user|>
{question}</s>
<|assistant|>"""


class AdvisorView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        question = (request.data.get("question") or "").strip()
        if not question:
            return Response({"detail": "question is required"}, status=status.HTTP_400_BAD_REQUEST)

        hf_token = getattr(settings, "HF_API_TOKEN", "")
        if not hf_token:
            return Response(
                {"detail": "Synergy Advisor is not yet configured. The HF_API_TOKEN secret needs to be set in GCP."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        territory_ctx = _build_territory_context()
        analysis_ctx = _build_analysis_context(request.user)
        prompt = SYSTEM_PROMPT.format(
            territory_context=territory_ctx,
            analysis_context=analysis_ctx,
            question=question,
        )

        # Try primary model (Zephyr-7B), fall back to Mistral v0.2 on failure
        answer = ""
        last_error = ""
        for url in (HF_API_URL, HF_FALLBACK_URL):
            try:
                answer = _call_hf(url, prompt, hf_token, max_new_tokens=600)
                if answer:
                    break
            except RuntimeError as exc:
                last_error = str(exc)
                logger.warning("Model %s failed: %s — trying fallback", url, exc)

        if not answer:
            return Response(
                {"detail": last_error or "Model returned an empty response. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({"answer": answer})
