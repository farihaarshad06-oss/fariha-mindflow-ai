# ADR 005: Managed Speech-to-Text

## Status

Accepted

## Context

Transcription quality and privacy matter; we also need a runnable local dev
experience without cloud credentials.

## Decision

Define a `TranscriptionProvider` interface. Provide a deterministic
`MockTranscriptionProvider` for local dev and an `AzureSpeechTranscriptionProvider`
skeleton. An optional OpenAI adapter interface is reserved.

## Consequences

- Local development and tests need no Azure Speech credentials.
- Production can swap in Azure AI Speech via configuration.
