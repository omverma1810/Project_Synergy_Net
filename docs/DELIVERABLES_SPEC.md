# Synergy Net — Investor Deliverables Spec

Derived from analysing two client-supplied reference documents:
- **An American Odyssey — Business Plan** (18 pp) → the *finance-first business plan / report* archetype
- **First Christmas — Pitch Deck** (214 pp) → the *visual/creative pitch deck* archetype

The platform must auto-generate **both** deliverables from a filmmaker's guided
intake, with the **finance section being the most scrutinised by producers**.

---

## Archetype A — Business Plan / Report (finance-first)

Reference: *An American Odyssey*. Section order and what each contains:

1. **Title** — film title, "Business Plan", written/directed by, producer names.
2. **Table of Contents** — page-linked section index.
3. **The Story** — logline / short synopsis (~60–90 words).
4. **Production Company** — partner prodco bio + comparable titles (posters).
5. **Producer's Note** — personal first-person letter (vision + commercial angle).
6. **Based on a True Story** *(optional)* — real photos + film stills, provenance.
7. **Budget** — headline **Gross vs Net**, category **pie chart**
   (Production, Post, Contingency, Pre-Pro/Development, Legal & Finance, Marketing),
   and a **Tax Credit / rebate callout** (e.g. Kentucky 30–35% → ~$1.2M refund).
8. **Target Audience** — who + why, market-gap narrative.
9. **Financing Plan** — sources **waterfall** (tax-credit cash-flow, equity,
   gap/pre-sales, strategic investors) summing to total budget + named investors.
10. **Cast** — principal + cameos, headshots, role names, `attached` vs `potential`.
11. **Production Strategy** — how the budget is controlled (locations, schedule, incentives).
12. **Proposed Schedule** — Development → Pre-Pro → Production → Post → Festival → Release.
13. **Financial Comps** — comparable films: title, budget, domestic gross, worldwide gross.
14. **Financial Analysis** ⭐ *(the crux producers read)* — **probabilistic revenue
    forecast** (Cinelytic-style): Domestic + International, broken out by
    **distribution window** (Box Office, DVD/Blu-ray, VOD, Pay TV, TV) and by
    **confidence level** (90% → 10%, with a Median 50% column). Headline totals
    (International / Domestic / Total).
15. **Distribution Strategy** — festival premiere, sales agent/distributor, theatre count.
16. **Recoupment Schedule** — release-window waterfall with timing
    (US Theatrical → Intl Theatrical → SVOD/AVOD → PPV → Home Video → Airline →
    Pay TV → Basic Cable → Free TV; rights renegotiated 5–10 yrs).
17. **Investment Returns** — recoupment terms (e.g. investors recoup **120%** first,
    then **50/50** net-profit split in perpetuity) + **Risks** disclaimer.
18. **The Team** — key bios with photos.

### Finance mechanics the engine must model
- Gross budget vs **Net** (net = gross − tax credit/rebate).
- Tax credit / rebate by territory (already handled by `analysis/engine.py`).
- **Financing waterfall**: rebate cash-flow + equity + gap/pre-sales + strategic.
- **Probabilistic revenue** by window × confidence level (domestic + international).
- **Recoupment waterfall**: priority + investor recoup multiple → profit split.
- **Comps** table: comparable films budget vs domestic/worldwide.

---

## Archetype B — Pitch Deck (visual / creative)

Reference: *First Christmas*. Emphasis is mood, tone, and talent, not spreadsheets:

1. **Title / Poster** — key art + tagline + format ("A dramedy feature film").
2. **Mood / Tone stills** — full-bleed reference imagery grids.
3. **Logline + Specs** — Format (Feature), **Genre**, **Runtime**, one-line hook.
4. **Synopsis** — character-led, multi-paragraph story with named leads + arcs.
5. **Cast** — headshots per role with `Attached` / `Potential` status.
6. **Film Tone Comparables** — 3+ reference films by *tone* (stills, no finance).
7. *(remaining pages)* — look-book, character breakdowns, locations, director's
   vision, world/visual language — the "vast" creative expansion.

Note: only the opening ~20 of 214 pp were sampled; the bulk is visual look-book
expansion. A full page-by-page pass is warranted before building the deck generator.

---

## Mapping to the current platform

- The **IncentiveEngine** (`apps/api/analysis/engine.py`) already computes rebates,
  financing PV, and recoupment priority — this feeds Budget (§7), Financing (§9),
  and Recoupment (§16) directly.
- **Gaps to build**: probabilistic revenue model (§14), comps library (§13),
  intake-driven creative fields (synopsis, cast attachment, tone comps, look-book),
  and two rendered outputs (PDF report + slide-style pitch deck).
- Intake must be **non-technical & guided** — the filmmaker answers prompts; the
  platform assembles both deliverables. Finance inputs can fall back to spend
  estimates so a deck/report can be produced before a full budget is uploaded.

---

---

## Archetype C — Financial Model & Structuring Analysis ⭐ (THE flagship deliverable)

Reference: **"Don't Drink That!" — Internal Sample Financial Model** (Synergy UK's own
gold-standard workbook, 12 tabs). This is the most rigorous and important output —
a producer/investor-grade financial structuring workbook. Its central thesis is the
**Net Cash Exposure model**: the rebate is a first-loss safety buffer, so the real
investor hurdle sits *below* the gross budget.

### The 12 tabs
1. **Project Financial Index** — cover + navigation + "Net Logic" hero (Gross → Tax Shield → Net Exposure).
2. **Market/Cannes Executive Summary** — one-page investor front page; "safer than a normal $4M film"; simplified 30/70 waterfall; scenario ROI read (Floor/Base/Breakout); breakout inputs.
3. **Finance 101 (Glossary)** — plain-English definitions for non-finance investors.
4. **Assumptions & Controls ("Truth Tab")** — core inputs; diligence controls (budget lock, tax qualification, completion bond, cash mgmt, chain of title) each with owner/status/risk level; **budget sensitivity scenarios** (Base, 5% overrun, 10% overrun, rebate downside 40%, no-incentive 0%); audit trail.
5. **Finance Summary** — Executive Budget KPIs; **cash-flow draw schedule** (Prep 15% / Photography 55% / Post 20% / Delivery 10%); Top 10 cost centers; **Sources = Uses** check; greenlight PASS/FAIL controls.
6. **Budget Overview** — 25 account categories, ATL/BTL/Post/Other totals, cost reporting (subtotal/actual/variance).
7. **Budget Breakdown** — line-by-line (acct x.y) with vendor, amount, commitment status, funding bucket, and **legislative eligibility category + haircut per line**.
8. **Incentive Calculation** — the crux of the rebate engine (see below).
9. **Revenue Projections** — 3-scenario (Floor / Base / Breakout): Worldwide Gross → less 30% distribution haircut → Net Project Revenue vs Net Cash Exposure, with coverage multiples.
10. **Project Performance Estimator** — bottom-up **window × region benchmark build** (US Theatrical, VOD by platform, territorial MGs by country, Airline, Global TV/PPV) across Floor/Base/Upside; KPIs (break-even multiplier, cash-on-cash, revenue capture %).
11. **Disclosures & Risk Factors** — no-offer-to-sell, forward-looking, macro clause, non-reliance, PPM reference.
12. **Investor Snapshot** — one-page capital-stack waterline (rebate = bottom slice / investor = top slice), safety shield, hurdle, breakout multiple.
    (+ Finance Definitions + Notes with legal sources, e.g. BOE Ley 27/2014 Art 36.2.)

### The finance engine spec (from "Don't Drink That!")
Worked example: Gross **$4,145,000** → Eligible spend **$2,535,000** → Rebate **$1,246,266** (blended 49.2%) → **Net Cash Exposure $2,898,734**.

1. **Net Cash Exposure = Gross Budget − Tax Rebate** — the headline investor metric.
2. **Eligible-spend haircut engine**: every budget line → legislative category → haircut %
   (Local Crew/Technical 100%, Local Service Provider 100%, Local Travel/Catering 100%,
   Local Post/VFX 100%, Payroll Fringes 100%, Creative Staff 100% *only if* Spain/EEA
   residency confirmed else 0%, Rights/Music 0% until confirmed, Financing/Legal/Admin/
   Contingency 0%).
3. **Tiered rebate w/ FX & caps** (Canary Islands, Ley 27/2014 Art 36.2): convert USD→EUR
   at live ECB rate; **54% on first €1M + 45% on excess**; 80%-of-total-cost eligibility
   cap; min €1M spend (feature) / €200k (animation/post); min 14 shoot days; €36M legal cap.
   → blended effective rate.
4. **Scenario framework**: Base / 5% overrun / 10% overrun / rebate-downside (40%) / no-incentive (0%).
5. **Revenue = 3 tiers (Floor/Base/Breakout)** built bottom-up from window×region benchmarks.
6. **30% distribution haircut** off worldwide gross → Net Project Revenue.
7. **Coverage / break-even multiplier = Net Project Revenue ÷ Net Cash Exposure** (≥1.0x = money back).
8. **Cash-on-cash = Net Project Revenue − Net Cash Exposure**.
9. **Capital-stack waterline**: rebate = bottom (first-loss) slice; investor capital = top slice.
10. **Greenlight gating**: Sources=Uses, budget ties, net-budget ties → PASS/FAIL.

### How A / B / C relate
- **C ("Don't Drink That!")** is the rigorous finance backbone — this is the model to build first and get exactly right.
- **A (American Odyssey)** wraps that finance in a full investor **business plan** (adds Cinelytic-style probabilistic forecast, comps, cast, team, distribution, recoupment prose).
- **B (First Christmas)** is the **creative pitch deck** (visual, tone, talent).
- The platform's intake feeds all three; the same computed finance core powers the Budget/Financing/Revenue/Recoupment sections of A and C.

---

*This spec is the reference for the report + pitch-deck generation feature. Archetype C
(the Net-Cash-Exposure financial model) is the flagship and should be engineered first.
The current `analysis/engine.py` already computes rebates, financing PV, and recoupment
priority — it is the seed to extend into the full haircut/tiered-rebate/scenario engine
above.*
