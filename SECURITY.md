# Security Policy

## Reporting a vulnerability

If you discover a security issue, **do not open a public issue**. Report it
privately via GitHub security advisories or the project maintainers. We aim to
acknowledge reports within 72 hours.

## Scope

This repository contains a Phase 1 scaffold. Known limitations (not
vulnerabilities) are documented in `docs/SECURITY.md` and `ROADMAP.md`.

## Supported versions

- `main` (Phase 1)

## Hardening expectations

- Least privilege for all service identities.
- Secrets managed in Azure Key Vault, never in the repo.
- Safe, PII-free error messages with request ids.
- Rate limiting, CORS restrictions and secure headers enabled.
- Encryption in transit and managed encryption at rest.

## Dependency management

- `pnpm audit` runs in CI.
- Dependabot keeps dependencies current.
- CodeQL runs on every push/PR to `main`.
