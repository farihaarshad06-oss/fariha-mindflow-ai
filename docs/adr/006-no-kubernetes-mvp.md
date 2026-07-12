# ADR 006: No Kubernetes for the MVP

## Status

Accepted

## Context

Kubernetes adds operational complexity disproportionate to Phase 1 needs.

## Decision

Use Azure Container Apps (serverless containers) instead of AKS/Kubernetes for
the MVP.

## Consequences

- Lower operational burden and cost.
- Easy scale-to-zero for workers.
- Can migrate to AKS later if needed.
