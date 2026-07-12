# ADR 008: Prisma over TypeORM

## Status

Accepted

## Context

The repository had no established ORM. We needed type-safe queries, migrations
and a pgvector-compatible schema.

## Decision

Use **Prisma** as the ORM. The canonical schema is `services/api/prisma/schema.prisma`.
Phase 1 runtime uses in-memory repositories behind interfaces for local
execution; Prisma becomes the production data layer.

## Consequences

- Strong typing and first-class migrations.
- pgvector supported via raw/`Float[]` columns.
- Runtime repositories are swappable without changing controllers.
