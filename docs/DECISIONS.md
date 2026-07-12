# Decisions

This file indexes the Architecture Decision Records in `docs/adr/`.

| ADR | Title |
| --- | --- |
| [001](./adr/001-azure-cloud.md) | Azure Cloud |
| [002](./adr/002-postgresql-pgvector.md) | PostgreSQL + pgvector |
| [003](./adr/003-rest-websocket.md) | REST + WebSocket foundation |
| [004](./adr/004-azure-blob-sas.md) | Azure Blob SAS uploads |
| [005](./adr/005-managed-stt.md) | Managed Speech-to-Text |
| [006](./adr/006-no-kubernetes-mvp.md) | No Kubernetes for MVP |
| [007](./adr/007-web-first.md) | Web-first delivery |
| [008](./adr/008-prisma-or-typeorm.md) | Prisma over TypeORM |

## Guiding principles

- Provider abstractions with mock defaults so local development needs no cloud
  credentials.
- Explicit, per-session recording consent.
- Privacy-first, EU/Swiss aligned.
- Monorepo with pnpm + Turborepo for fast, cached builds.
