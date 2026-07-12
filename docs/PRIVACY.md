# Privacy

Fariha MindFlow AI is designed for Switzerland (FADP) and the EU (GDPR).

## Commitments

- Explicit, per-session recording consent; recording never starts automatically.
- Visible recording indicator while capturing audio.
- Configurable audio retention.
- Account deletion and lecture deletion with storage cleanup.
- User data export (GDPR Art. 20 / FADP).
- No use of user content to train AI models by default.
- PII-safe logs and audit trails.

## Data minimization

- Only collect what is needed for the learning experience.
- Transcripts and audio are tied to the owning user; admin views do not expose
  private lecture contents by default.

## User rights

- Access, rectification, export and erasure via settings and the
  `DataExportRequest` / `DeletionRequest` tables.
- Consent history is retained in `ConsentRecord`.

## Cross-border

- Azure region is configurable; EU/Swiss regions are the default target.
- Data processing agreements are required before production rollout.

See also [RECORDING_CONSENT.md](./RECORDING_CONSENT.md) and
[SECURITY.md](./SECURITY.md).
