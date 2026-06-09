# Synergy-Net

A full-stack professional networking platform monorepo.

## Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | Next.js 15 (App Router), TypeScript |
| Backend     | Django 5 + Django REST Framework    |
| Real-time   | Django Channels + Redis             |
| Database    | PostgreSQL 16                       |
| Cache/Queue | Redis 7                             |
| Auth        | JWT (SimpleJWT) + OAuth2            |
| Container   | Docker + Docker Compose             |
| Package Mgr | pnpm (frontend), pip/uv (backend)   |

## Project Structure

```
synergy-net/
├── frontend/          # Next.js application
├── backend/           # Django application
├── docker/            # Docker configs & scripts
├── docs/              # Architecture & API docs
├── Makefile           # Dev workflow commands
└── docker-compose.yml # Local dev orchestration
```

## Quick Start

```bash
# Start all services
make dev

# Run database migrations
make migrate

# Seed demo data
make seed

# Run linters
make lint

# Run tests
make test
```

## Phase Tracker

- [ ] Phase 1 — Project initialization & monorepo setup
- [ ] Phase 2 — Django backend scaffold (models, auth, REST API)
- [ ] Phase 3 — Next.js frontend scaffold (App Router, auth flow)
- [ ] Phase 4 — Real-time features (WebSockets, notifications)
- [ ] Phase 5 — Search & recommendations (PostgreSQL full-text)
- [ ] Phase 6 — File uploads & media (Vercel Blob / S3)
- [ ] Phase 7 — Production hardening & deployment
