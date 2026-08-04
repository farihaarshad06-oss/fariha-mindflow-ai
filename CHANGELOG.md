# Changelog

All notable changes to Fariha MindFlow AI are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-08-04

### Added
- **Safe database migration strategy**: the app now creates a timestamped backup of
  the SQLite database before running any migration. On failure the backup is
  automatically restored and a clear user-facing error is shown. Data is never
  silently dropped.
- **SQLite reliability pragmas**: WAL journal mode, 10-second busy timeout,
  foreign-key enforcement and `synchronous=NORMAL` are applied on every connect.
- **Route-level code splitting**: all heavy pages (Recorder, Chat, Settings,
  ModelManager, StudyPlan, LectureDetail, CourseDetail) are now lazy-loaded
  so the initial JS bundle is significantly smaller.
- **CI bundle-size gate**: a new `bundle-size` CI job fails the build if any
  single JS chunk exceeds 600 KB, preventing regression to the previous
  ~542 KB monolithic bundle.
- **CI lint enforcement**: the `|| true` suppression has been removed from the
  lint step; lint failures now correctly block the CI pipeline.
- **Strict `no-unused-vars` configuration for desktop**: the ESLint rule now
  honours the `_` prefix convention for intentionally-unused destructured
  variables and function parameters, eliminating spurious warnings without
  disabling the rule.

### Changed
- Bumped application version to **1.0.0** across all relevant package manifests.
- Removed the `blank.yml` placeholder GitHub Actions workflow.

### Fixed
- Removed the `--accept-data-loss` fallback (`prisma db push`) that could
  silently drop columns or tables when `prisma migrate deploy` failed. The
  application will now surface a recoverable error instead of destroying data.
- Restored the missing `const model = resolveModel(…)` call inside `aiRequest`
  that caused `model` to be used-before-defined (a latent runtime crash bug).
- Resolved all 9 pre-existing ESLint warnings (unused variables in destructuring
  patterns across `aiProviders.ts`, `backup.ts`, `learning.ts`, `handlers.ts`
  and `phase2a.test.ts`).

### Security
- **safeStorage**: `SecretsService` already refuses to store secrets when
  `safeStorage.isEncryptionAvailable()` returns `false` (Linux without a
  secret service) and throws a clear error. This behaviour is unchanged and
  remains the correct production stance: no silent plaintext fallback.
- Authorization headers and secret values continue to be redacted from all
  log outputs via the main-process log transform.

### External Blockers (not code defects)
- **Code signing certificate**: Windows NSIS installer is unsigned. Signtool
  signing requires a purchased EV or OV certificate that is not available in
  CI. `CSC_IDENTITY_AUTO_DISCOVERY=false` suppresses the non-fatal warning.
- **macOS DMG**: Not built or smoke-tested; no macOS CI runner is configured.
  macOS should not be advertised as production-verified until a macOS runner
  is added.
- **Real audio recording / Whisper transcription**: Cannot be verified in a
  headless CI environment — requires physical microphone hardware, a running
  Electron GUI and a downloaded Whisper model.
- **Live AI provider tests**: Require real API credentials. All provider
  contract tests use local mocked HTTP responses.

---

## [0.1.0] — 2026-07-01

Initial development release. Core architecture, Prisma schema, IPC layer,
recording service, Whisper worker, AI providers, backup service, and web UI
scaffolding.
