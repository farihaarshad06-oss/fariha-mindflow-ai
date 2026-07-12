# ADR 002: PostgreSQL + pgvector

## Status

Accepted

## Context

We need relational integrity for users/courses/lectures and vector similarity
for RAG retrieval.

## Decision

Use PostgreSQL with the `pgvector` extension. Embeddings are stored as
`float[]` and queried via pgvector operators.

## Consequences

- Single datastore for relational + vector data.
- Simpler operations than running a separate vector DB.
- Needs the pgvector-enabled image in Docker (`pgvector/pgvector`).
