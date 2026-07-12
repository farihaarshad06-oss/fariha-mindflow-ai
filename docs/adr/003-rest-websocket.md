# ADR 003: REST + WebSocket foundation

## Status

Accepted

## Context

The MVP needs a stable, typed HTTP API. Future live transcription benefits from
streaming.

## Decision

Build a REST API under `/api` as the primary interface. Lay a WebSocket
foundation (module/abstraction) for future live transcription without
implementing it in Phase 1.

## Consequences

- Simple, cacheable, well-documented endpoints (Swagger).
- Future real-time features can be added behind the same gateway.
