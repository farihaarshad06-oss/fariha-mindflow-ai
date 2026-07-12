# Testing

## Levels

| Layer | Tool | Location |
| --- | --- | --- |
| Unit (frontend) | Vitest + RTL | `apps/web/src/**/*.test.tsx` |
| Unit (backend) | Jest + Supertest | `services/api/src/**/*.spec.ts` |
| Worker unit | Jest | `services/*/src/**/*.spec.ts` |
| E2E | Playwright | `tests/e2e` |
| Integration | Testcontainers (foundation) | `tests/integration` |
| Accessibility | axe-core | `apps/web/src/test/a11y.test.tsx` + `tests/accessibility` |
| Performance | k6 | `tests/performance` |

## Running

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test            # unit across all packages
pnpm test:e2e        # Playwright (requires built apps + running services)
```

## What is covered in Phase 1

- API: health endpoint, validation error format, request id, roles guard,
  lecture states.
- Web: dashboard render, navigation, recorder consent, loading/empty states,
  RTL direction, axe smoke.
- Workers: deterministic mock providers, idempotency, dead-letter, citations.
- Admin: dashboard render.

## Conventions

- Tests use mock providers and never require paid AI/Azure credentials.
- No network or secret access in unit tests.
- `pnpm test` is part of the CI `ci` script.
