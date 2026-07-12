# ADR 004: Azure Blob SAS uploads

## Status

Accepted

## Context

Large audio files should not pass through the API. Clients need direct, scoped
uploads.

## Decision

Clients request a short-lived SAS URL from the API (`POST /uploads/request`),
upload directly to Blob Storage, then call `POST /uploads/:id/complete`. The
mock provider returns a local URL for development.

## Consequences

- API is not a bottleneck for media.
- Uploads are ownership-scoped and time-limited.
- Safe validation of MIME type, extension, size and purpose.
