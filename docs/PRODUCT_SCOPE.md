# Product Scope

**Fariha MindFlow AI** is an AI-powered learning companion for university
students, Ausbildung learners, medical and nursing students, IT students,
language learners, professionals, researchers and lifelong learners.

## Problem

Learners accumulate long lecture recordings but lack time to transcribe,
summarize and structure them. They need help turning raw audio into study-ready
material: summaries, key concepts, flashcards, quizzes and source-grounded
answers.

## Target users

- University students (medical, nursing, IT, language)
- Ausbildung (vocational training) learners
- Professionals and researchers in continuous education
- Lifelong learners

## Core capabilities (Phase 1 MVP vertical slice)

1. **Record** lectures with explicit, per-session consent (browser MediaRecorder).
2. **Upload** audio through short-lived, ownership-scoped SAS URLs.
3. **Transcribe** audio (mock provider locally, Azure AI Speech adapter interface).
4. **Summarize** and extract **key concepts** via an LLM provider abstraction.
5. **Generate flashcards** and prepare quiz foundations.
6. **Chat** with a course using source-grounded answers and citations.
7. **Organize** courses, lectures, assignments and weak-topic recommendations.
8. **Admin** operations: users, lecture processing, jobs, usage, audit logs.

## Out of scope for Phase 1

- Production PostgreSQL wiring (schema is provided; runtime uses in-memory
  repositories behind interfaces for local execution).
- Live Azure / OpenAI credentials (provider abstractions default to mocks).
- Real WebSocket live transcription (foundation only).
- Full mobile product (Expo skeleton only).
- Kubernetes (explicitly excluded for the MVP).

## Privacy posture

Designed for Switzerland (FADP) and the EU (GDPR). Recordings never start
automatically, always require explicit consent, and user content is not used to
train AI models by default. See [PRIVACY.md](./PRIVACY.md) and
[RECORDING_CONSENT.md](./RECORDING_CONSENT.md).
