# Troubleshooting

## `pnpm install` fails on Node version

Use the version in `.nvmrc` (>= 20.18). Run `corepack enable` so the correct
pnpm is used.

## Port conflicts

- API: 3333
- Web: 5173
- Admin: 4173
- Postgres: 5432
- Redis: 6379
- Adminer: 8080

Stop other processes using these ports or change them in `.env` / compose.

## API health returns 500

Check logs for a missing/required env var. All vars have safe defaults in
`@mindflow/validation`, so a 500 usually means a coding error — open an issue.

## CORS errors in the browser

Ensure `CORS_ORIGINS` includes the web/admin origin (comma-separated).

## Docker Compose validation

```bash
pnpm docker:config
```

If it fails, validate YAML indentation and that volumes/networks are declared.

## Web app blank / RTL issues

Ensure `dir` is set on `<html>`. The i18n layer sets `dir` to `rtl` for Dari
(`fa`) automatically.

## Tests failing

- Unit tests use mocks and need no network.
- E2E (`pnpm test:e2e`) requires built apps and running services.
- Worker tests are deterministic; re-run `pnpm test`.

## Secrets

Never commit `.env`. Rotate any leaked credential immediately and update Key
Vault.
