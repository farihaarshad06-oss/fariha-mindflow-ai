# Contributing

Thanks for contributing to Fariha MindFlow AI.

## Getting started

1. Fork and clone the repository.
2. Run `corepack enable` and `pnpm install`.
3. Copy `.env.example` to `.env`.
4. Run `pnpm docker:up` for local Postgres/Redis.
5. Run `pnpm dev` to start all workspaces.

## Branching

- `main` is protected and receives PRs only.
- Feature work happens on short-lived branches off `scaffold/phase1` (Phase 1) or
  `main` (later).
- Keep commits focused and write clear messages (`feat:`, `fix:`, `chore:`).

## Before opening a PR

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm docker:config
```

All of these run in CI as well.

## Standards

- TypeScript strict mode; no `any` where avoidable.
- Shared code belongs in `packages/*`.
- User-facing text must use translation keys (see `apps/web/src/i18n`).
- No secrets, credentials or `.env` files in the repository.
- Provider integrations must default to mocks for local development.

## Pull requests

- Use the PR template summary.
- Link related issues.
- Do not merge your own PR without review.
- CI must be green.
