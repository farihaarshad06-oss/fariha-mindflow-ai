# Database Schema

The canonical schema lives in `services/api/prisma/schema.prisma` (Prisma +
PostgreSQL + pgvector). Phase 1 runs the API on in-memory repositories behind
interfaces; the Prisma schema is the migration source of truth.

## Decisions

- **ORM:** Prisma (see `docs/adr/008-prisma-or-typeorm.md`).
- **Vector search:** `Float[]` embeddings consumed by pgvector.
- **Soft deletion:** lecture/account deletion uses state flags, not hard deletes.

## Tables

| Table | Purpose |
| --- | --- |
| `User` | Accounts, roles, status |
| `UserProfile` | Onboarding data, consent flag, language, goals |
| `Session` | Refresh tokens / revocation |
| `RoleAssignment` | Optional role catalog |
| `Course` | Course metadata, weak topics, progress |
| `CourseMember` | Course membership |
| `Lecture` | Lecture lifecycle state machine |
| `LectureAudioFile` | Audio metadata + storage URL |
| `TranscriptSegment` | Timestamped transcript lines |
| `LectureSummary` | Generated summary |
| `KeyConcept` | Extracted concepts |
| `Flashcard` | Study flashcards |
| `Document` / `DocumentPage` | Uploaded documents |
| `Embedding` | Vector embeddings for RAG |
| `ChatThread` / `ChatMessage` | Conversations + citations |
| `ProcessingJob` | Queue jobs with retry metadata |
| `UsageEvent` | Transcription minutes / tokens / storage |
| `AuditLog` | Immutable-ish audit trail |
| `ConsentRecord` | Recording consent history |
| `DataExportRequest` / `DeletionRequest` | GDPR/FADP requests |

## Lecture lifecycle states

`DRAFT → RECORDING → UPLOADING → UPLOADED → QUEUED → TRANSCRIBING →
TRANSCRIBED → ANALYZING → READY`, with `FAILED` and `DELETED` as terminal
states.

## Processing job metadata

Every `ProcessingJob` records: `jobType`, `status`, `retryCount`,
`maxRetries`, `errorCode`, `safeErrorMessage`, `diagnosticReference`,
`createdAt`, `updatedAt`, `startedAt`, `completedAt`.

## Seed data

`services/api/prisma/seed.ts` generates a development-only demo student, course,
lecture, transcript, summary and flashcards. It is **not** run automatically and
must never be executed against production data.
