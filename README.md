# Fariha MindFlow AI

**Your Personal AI Learning Companion**

Fariha MindFlow AI helps students and lifelong learners record lectures, get
them transcribed, and turn them into summaries, key concepts, flashcards and
source-grounded answers — with privacy and explicit recording consent at the
core.

> Status: **Phase 1 scaffold** — monorepo, API, web/app/admin apps, workers,
> provider abstractions and infrastructure skeleton. Local development runs on
> mock providers and in-memory data; no cloud credentials required.

## Architecture summary

- **Monorepo:** pnpm workspaces + Turborepo.
- **Web:** React + TypeScript + Vite + Tailwind + React Router + TanStack Query
  + Zustand + Framer Motion, localized (de/en/fr/fa, RTL for Dari).
- **Admin:** React + Vite operations dashboard.
- **Mobile:** Expo React Native skeleton.
- **API:** NestJS (`/api`) with auth, users, courses, lectures, uploads, jobs,
  audit logs and usage.
- **Workers:** `ai-worker` and `transcription-worker` with provider
  abstractions (mock / Azure / OpenAI).
- **Shared packages:** `ui`, `config`, `types`, `validation`, `api-client`,
  `eslint-config`, `tsconfig`.
- **Infra:** Docker Compose (Postgres + pgvector, Redis, Adminer) and a Terraform
  Azure skeleton (Container Apps, PostgreSQL, Blob, Service Bus, Key Vault).

## Monorepo structure

```
apps/   web · admin · mobile
services/ api · ai-worker · transcription-worker
packages/ ui · config · types · validation · api-client · eslint-config · tsconfig
infrastructure/ docker · terraform
docs/   ADRs + architecture, API, security, privacy, deployment, testing
tests/  e2e · integration · accessibility · performance
.github/workflows/ ci · codeql · dependabot
```

## Prerequisites

- Node.js >= 20.18 (see `.nvmrc`)
- pnpm >= 9 (`corepack enable`)
- Docker (optional, for local Postgres/Redis/Adminer)

## Local setup

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm docker:up        # postgres + redis + adminer (optional)
pnpm dev              # start all workspaces
```

## Environment setup

See `.env.example`. Every variable has a safe default so the app runs locally
without Azure/OpenAI credentials.

## Database startup

```bash
pnpm db:up            # postgres + redis
pnpm docker:up        # also starts adminer on :8080
```

## Development commands

```bash
pnpm dev          # run all apps/services
pnpm build        # build everything
pnpm typecheck    # type-check all packages
pnpm lint         # lint all packages
pnpm test         # unit tests
pnpm docker:config  # validate compose file
```

## Test commands

```bash
pnpm test              # unit tests (vitest/jest)
pnpm test:e2e          # Playwright e2e (requires running apps)
pnpm test:integration  # Postgres integration foundation (requires Docker)
```

## Docker commands

```bash
pnpm docker:config   # validate configuration
pnpm docker:up       # start services
pnpm docker:down     # stop services
```

## Health endpoint

```bash
curl http://localhost:3333/api/health
# { "status": "ok", "service": "mindflow-api", "timestamp": "...", "version": "0.1.0" }
```

## Privacy note

Recordings never start automatically and always require explicit, per-session
consent. The product is designed for GDPR and the Swiss FADP. No user content is
used to train AI models by default. See `docs/PRIVACY.md` and
`docs/RECORDING_CONSENT.md`.

## Contribution process

1. Branch from `scaffold/phase1` (or `main` after merge).
2. Keep changes focused; add tests for behavior.
3. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
4. Open a PR into `main`; CI must pass.
5. Do not commit secrets or `.env`.

## Documentation

See `docs/` — especially `ARCHITECTURE.md`, `API.md`, `AI_PIPELINE.md`,
`DATABASE_SCHEMA.md`, `SECURITY.md` and the ADRs under `docs/adr/`.
