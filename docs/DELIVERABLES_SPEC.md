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

*This spec is the reference for the report + pitch-deck generation feature. A full
end-to-end implementation plan should be produced (analysing all reference docs
page-by-page) before building.*
