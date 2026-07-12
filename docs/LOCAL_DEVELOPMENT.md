# Local Development

## Prerequisites

- Node.js >= 20.18 (see `.nvmrc`)
- pnpm >= 9 (`corepack enable`)
- Docker (optional, for Postgres/Redis/Adminer)
- Azure CLI (only for Terraform)

## Setup

```bash
corepack enable
pnpm install
cp .env.example .env        # adjust if needed
pnpm docker:up              # start postgres + redis + adminer
pnpm dev                    # start all apps/services via Turborepo
```

## Useful scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Run all workspaces in dev mode |
| `pnpm build` | Build all packages and apps |
| `pnpm typecheck` | Type-check across the monorepo |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run unit tests |
| `pnpm docker:up` | Start Postgres, Redis, Adminer |
| `pnpm docker:down` | Stop them |
| `pnpm db:up` | Start only Postgres + Redis |

## Running the API

```bash
pnpm --filter @mindflow/api start
curl http://localhost:3333/api/health
```

## Running the web app

```bash
pnpm --filter @mindflow/web dev      # http://localhost:5173
```

## Running the workers

```bash
pnpm --filter @mindflow/transcription-worker start
pnpm --filter @mindflow/ai-worker start
```
