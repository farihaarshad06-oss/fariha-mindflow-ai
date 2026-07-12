# Security

> This document describes the Phase 1 security foundation. It is **not** a
> certification of compliance.

## Principles

- Secure by default; least privilege.
- No secrets in the repository.
- Safe, PII-free error messages.
- Defense in depth for recording and data deletion.

## Implemented foundations

- JWT access tokens (HS256) with configurable expiry and refresh-token
  revocation interface.
- `@Roles()` + `RolesGuard` for authorization.
- `@Public()` decorator to keep only intended endpoints open.
- Global `ValidationPipe` (whitelist + transform).
- `AllExceptionsFilter` normalizes errors and attaches a `requestId`.
- Helmet, compression, CORS restricted to `CORS_ORIGINS`.
- Rate-limiting scaffold via `@nestjs/throttler`.
- Structured logging that scrubs secrets and avoids PII.
- Audit logging for security-relevant actions.
- Upload validation: MIME type, extension, size, ownership, purpose.

## Transport & storage

- TLS in transit (enforced at the ingress / Container Apps level).
- Managed encryption at rest for PostgreSQL, Blob Storage and Service Bus.
- Short-lived SAS URLs for direct uploads.

## Dependency hygiene

- `pnpm audit` runs in CI.
- Pinned, workspace-scoped internal packages.

## Not yet implemented (Phase 2+)

- Real refresh-token rotation storage.
- Email verification and password reset flows (placeholders only).
- Fine-grained field-level authorization for admin views.
- CSP tuning and penetration testing.
