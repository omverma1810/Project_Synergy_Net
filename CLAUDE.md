# Project Synergy Net

Film production finance platform by **Synergy Media Labs** (A Synergy Media Corporation Company).

## Architecture

- `apps/api` — Django 5 REST API (DRF + SimpleJWT), deployed to GCP Cloud Run via GitHub Actions on push to `master` (`.github/workflows/deploy.yml`). Production settings: `synergy/settings_production.py`. DB: Supabase Postgres.
- `apps/web` — Next.js 14 App Router frontend, deployed to Vercel. All API calls go through the Next.js rewrite proxy (`next.config.mjs`) at `/api/*` → Cloud Run. **The rewrite destination must keep the trailing slash** (`/api/:path*/`) or Django's APPEND_SLASH 301 converts POST→GET.
- DRF pagination is on globally (`PAGE_SIZE: 20`): every list endpoint returns `{count, next, previous, results}`. The frontend unwraps it with `unwrapList()` in `apps/web/src/lib/api.ts` — use that helper for any new list endpoint.

## Branding

- Company: **Synergy Media Labs** — logo assets: `apps/web/public/logo.jpg` (full lockup), `apps/web/public/logo-mark.jpg` (square feather mark), `apps/api/reports/static/logo.jpg` (embedded base64 in PDF reports).
- Brand components: `apps/web/src/components/Brand.tsx` (`SynergyMark`, `SynergyLogo`, `SynergyWordmark`).
- The AI assistant is named **Akira** (formerly "Synergy Advisor") — chat UI in `apps/web/src/components/SynergyAdvisor.tsx`, backend in `apps/api/advisor/views.py`. It calls HuggingFace's OpenAI-compatible router (`https://router.huggingface.co/v1/chat/completions`) with model fallbacks; token comes from the `HF_API_TOKEN` GCP secret.

## Product vision (owner's roadmap — not yet built)

The platform's end goal is a **one-stop platform for filmmakers** seeking investment/funding from producers:

1. A non-technical filmmaker registers, creates a project, and answers guided input prompts (project details, cast/crew, finances, timeline).
2. The platform auto-generates two investor-ready deliverables that today take days of manual work:
   - **A full project report** — modeled on the owner's sample Google Sheets workbooks; the **finance section is the most critical part** (it's what producers scrutinise).
   - **A pitch deck** — high-level, production-ready, investment-friendly, showing every relevant detail about the filmmaker and the film.
3. Owner will supply sample pitch decks, reports, and spreadsheet workbooks as references; a full implementation plan should be produced after analysing them end-to-end, then built and verified before deployment.

## Conventions

- Commit as `Claude <noreply@anthropic.com>`.
- Push to `master` triggers auto-deploy (API → Cloud Run, web → Vercel).
- Reports are regenerated on demand at download time (`reports/views.py`) because Cloud Run storage is ephemeral — never rely on saved files on disk.
