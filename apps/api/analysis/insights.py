"""Derived intelligence shared by the API serializers and the PDF report.

Everything here is computed from data already produced by the IncentiveEngine
and stored on the AnalysisResult, so it stays in lock-step between the
on-screen experience and the exported report.
"""
from decimal import Decimal


def _level_meta(level):
    return {
        'low': {'level': 'low', 'tone': 'positive'},
        'medium': {'level': 'medium', 'tone': 'caution'},
        'high': {'level': 'high', 'tone': 'warning'},
    }[level]


def derive_risk_flags(result):
    """Return a list of risk / consideration flags for a single AnalysisResult.

    Each flag: {key, category, level, label, detail}. Levels are low / medium /
    high where 'low' means low risk (favourable).
    """
    territory = result.territory
    details = result.details or {}
    flags = []

    # ── 1. Cash-flow / rebate payout timing ──────────────────────────────
    months = result.rebate_timing_months or 0
    if months >= 18:
        level, label = 'high', f'Long payout (~{months} months)'
    elif months >= 12:
        level, label = 'medium', f'Moderate payout (~{months} months)'
    else:
        level, label = 'low', f'Fast payout (~{months} months)'
    detail = 'Time from qualifying spend to rebate receipt — affects cash-flow and interim financing needs.'
    if result.loan_against_rebate_available:
        detail += ' A loan against the rebate is available to bridge the gap.'
    flags.append({'key': 'payout_timing', 'category': 'Cash-flow', **_level_meta(level), 'label': label, 'detail': detail})

    # ── 2. Eligibility: minimum qualifying spend ─────────────────────────
    total_budget = Decimal(str(details.get('total_budget', 0) or 0))
    if territory.min_spend and territory.min_spend > 0:
        headroom = (total_budget - territory.min_spend)
        if total_budget <= 0:
            level, label = 'medium', 'Minimum spend applies'
        elif headroom < (territory.min_spend * Decimal('0.15')):
            level, label = 'high', 'Budget close to minimum threshold'
        else:
            level, label = 'low', 'Comfortably above minimum spend'
        detail = f'Requires at least {territory.min_spend:,.0f} {territory.currency} of qualifying spend.'
        flags.append({'key': 'min_spend', 'category': 'Eligibility', **_level_meta(level), 'label': label, 'detail': detail})

    # ── 3. Local spend / crew rules ──────────────────────────────────────
    qualified = result.qualified_spend_total or Decimal('0')
    ratio = (qualified / total_budget) if total_budget else Decimal('0')
    crew_pct = territory.min_local_crew_percentage or Decimal('0')
    if crew_pct > 0 or ratio < Decimal('0.5'):
        if crew_pct >= 50 or ratio < Decimal('0.35'):
            level, label = 'high', 'Significant local spend / crew rules'
        elif crew_pct > 0 or ratio < Decimal('0.5'):
            level, label = 'medium', 'Local spend / crew conditions apply'
        else:
            level, label = 'low', 'Flexible local spend rules'
        bits = [f'~{ratio * 100:.0f}% of budget qualifies under current mapping.']
        if crew_pct > 0:
            bits.append(f'Minimum {crew_pct:.0f}% local crew required.')
        flags.append({'key': 'local_spend', 'category': 'Local spend', **_level_meta(level),
                      'label': label, 'detail': ' '.join(bits)})

    # ── 4. Application complexity ────────────────────────────────────────
    checklist = details.get('checklist_items', []) or []
    mandatory = [c for c in checklist if c.get('is_mandatory')]
    complexity_score = len(mandatory)
    if details.get('treaty_bonus'):
        complexity_score += 1
    if details.get('provincial_percentage'):
        complexity_score += 1
    if complexity_score >= 4:
        level, label = 'high', 'Complex application'
    elif complexity_score >= 2:
        level, label = 'medium', 'Moderate application'
    else:
        level, label = 'low', 'Straightforward application'
    detail = f'{len(mandatory)} mandatory requirement(s)'
    if details.get('treaty_bonus'):
        detail += ', co-production treaty structuring'
    if details.get('provincial_percentage'):
        detail += ', federal + provincial stacking'
    detail += '.'
    flags.append({'key': 'complexity', 'category': 'Application', **_level_meta(level), 'label': label, 'detail': detail})

    # ── 5. Estimate confidence ───────────────────────────────────────────
    confidence = float(result.confidence_score or 0)
    if confidence >= 0.8:
        level, label = 'low', f'High confidence ({confidence * 100:.0f}%)'
    elif confidence >= 0.65:
        level, label = 'medium', f'Moderate confidence ({confidence * 100:.0f}%)'
    else:
        level, label = 'high', f'Indicative only ({confidence * 100:.0f}%)'
    flags.append({'key': 'confidence', 'category': 'Confidence', **_level_meta(level),
                  'label': label, 'detail': 'Reflects how completely the budget mapped to this territory’s qualifying rules.'})

    return flags


def risk_summary(result):
    """A single headline risk level for a result: low / medium / high."""
    flags = derive_risk_flags(result)
    order = {'low': 0, 'medium': 1, 'high': 2}
    worst = max((order[f['level']] for f in flags), default=0)
    return ['low', 'medium', 'high'][worst]


def build_finance_snapshot(analysis):
    """Budget vs. estimated incentive vs. remaining finance gap, from the
    top-ranked territory of a completed analysis."""
    top = analysis.results.order_by('rank').first()
    if not top:
        return None

    details = top.details or {}
    # The finance gap is measured against the producer's full stated budget;
    # fall back to the engine's line-item total when no budget was entered.
    total_budget = analysis.project.total_budget or Decimal('0')
    if total_budget <= 0:
        total_budget = Decimal(str(details.get('total_budget', 0) or 0))

    rebate = top.estimated_rebate or Decimal('0')
    financing_pv = top.financing_benefit_estimate or Decimal('0')
    net_benefit = top.net_benefit or Decimal('0')
    gap = total_budget - rebate
    if gap < 0:
        gap = Decimal('0')

    pct = (rebate / total_budget * 100) if total_budget else Decimal('0')

    return {
        'currency': top.currency,
        'total_budget': float(total_budget),
        'top_territory': top.territory.name,
        'top_territory_id': top.territory_id,
        'estimated_incentive': float(rebate),
        'financing_pv': float(financing_pv),
        'net_benefit': float(net_benefit),
        'finance_gap': float(gap),
        'incentive_pct_of_budget': round(float(pct), 1),
        'gap_pct_of_budget': round(float((gap / total_budget * 100) if total_budget else 0), 1),
        'rebate_timing_months': top.rebate_timing_months,
        'loan_against_rebate_available': top.loan_against_rebate_available,
    }
