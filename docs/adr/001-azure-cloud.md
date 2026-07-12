# ADR 001: Azure Cloud

## Status

Accepted

## Context

The product targets Swiss and EU markets with managed, compliant infrastructure
and first-class support for PostgreSQL, Blob Storage, Service Bus, AI Speech and
OpenAI.

## Decision

Deploy on Microsoft Azure using managed services (Container Apps, PostgreSQL
Flexible Server, Blob Storage, Service Bus, Key Vault, Application Insights).

## Consequences

- Strong compliance posture for GDPR/FADP.
- Managed pgvector image available for PostgreSQL.
- Vendor lock-in mitigated by provider abstractions (storage, STT, LLM).
