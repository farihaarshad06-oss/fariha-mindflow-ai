# API

Base path: `/api`. Default port: `3333`.

## Health

`GET /api/health` →

```json
{
  "status": "ok",
  "service": "mindflow-api",
  "timestamp": "2026-07-10T09:00:00.000Z",
  "version": "0.1.0"
}
```

## Error format

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Safe user-facing message",
  "requestId": "uuid",
  "timestamp": "ISO timestamp",
  "path": "/api/..."
}
```

## Modules

| Module | Routes (under /api) |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, `GET /auth/providers` |
| Users | `GET /users`, `GET /users/:id`, `POST /users/:id/disable` (PLATFORM_ADMIN) |
| Courses | `GET /courses`, `GET /courses/:id`, `POST /courses`, `DELETE /courses/:id` |
| Lectures | `GET /lectures`, `GET /lectures/:id`, `POST /lectures`, `DELETE /lectures/:id` |
| ProcessingJobs | `GET /processing-jobs`, `GET /processing-jobs/:id` (admin) |
| Uploads | `POST /uploads/request`, `POST /uploads/:id/complete`, `DELETE /uploads/:id` |
| AuditLogs | `GET /audit-logs` (admin) |
| Usage | `GET /usage`, `GET /usage/events` (admin) |

## Auth

- Email + password (bcrypt) with JWT access + rotating refresh foundation.
- Guards: `@Public()`, `JwtAuthGuard`, `RolesGuard`; decorators: `@Roles()`,
  `@CurrentUser()`.
- Roles: `STUDENT`, `PROFESSIONAL`, `UNIVERSITY_ADMIN`, `SUPPORT`,
  `CONTENT_MODERATOR`, `PLATFORM_ADMIN`.

## Uploads

- `POST /uploads/request` validates MIME type, extension, size and purpose,
  then returns a short-lived upload URL (mock locally, SAS on Azure).
- Ownership is enforced on complete/delete.

## OpenAPI

Swagger UI is served at `/api/docs`.

## Client

`@mindflow/api-client` provides a typed `ApiClient` with request-id support,
normalized error handling and a `TokenStrategy` abstraction.
