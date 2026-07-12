# Roadmap

## Phase 1 (this branch)

- Monorepo scaffold, shared packages, design system.
- NestJS API with health, auth, courses, lectures, uploads, jobs, audit, usage.
- Web and Admin apps with required routes.
- Mobile Expo skeleton.
- Transcription and AI worker abstractions with deterministic mocks.
- Docker Compose (postgres + pgvector, redis, adminer) and Terraform skeleton.
- Docs + ADRs.

## Phase 2 (proposed)

- Wire Prisma to a real PostgreSQL instance; replace in-memory repositories.
- Azure Blob SAS upload end-to-end; real audio persistence.
- Azure AI Speech transcription provider implementation.
- Azure OpenAI / OpenAI provider implementation with evaluations.
- RAG chat backed by pgvector retrieval.
- Voice tutor foundation (text-to-speech interface).
- Refresh-token rotation and session revocation storage.
- Email verification and password reset flows.
- Production CI: build images, deploy to Container Apps, smoke tests.

## Phase 3+

- Live WebSocket transcription.
- Mobile feature completion.
- Advanced analytics and adaptive study plans.
- University admin bulk onboarding and consent management.
