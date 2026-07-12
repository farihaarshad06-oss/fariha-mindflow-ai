# Recording Consent

Recording lectures in an educational setting has legal and ethical
implications. Consent is a first-class concept in the product.

## Rules

1. **Never automatic.** The record control must be pressed explicitly by the
   user. The application never starts capture on its own.
2. **Visible indicator.** While recording, a clear visual indicator (REC badge
   + animated waveform) is shown.
3. **Per-session acknowledgment.** A lecture cannot be created without
   `consentAcknowledged = true` (enforced by `CreateLectureDto` and the API).
4. **Consent history.** Each acknowledgment is recorded in `ConsentRecord` with
   a version and timestamp.
5. **University requirements.** Institution-specific consent text can be shown
   during onboarding.

## Implementation

- `apps/web/src/pages/RecorderPage.tsx` gates the record button behind a
  consent checkbox and shows a consent notice until acknowledged.
- `POST /api/lectures` rejects requests where `consentAcknowledged` is false.
- `POST /api/auth/...` and onboarding capture `preferredLanguage` and
  `consentAcknowledged` via `@mindflow/validation`.

## Messaging

> "Recordings start only with your explicit consent."
> "I consent to recording learning sessions."

These strings are localized for German, English, French and Dari/Persian.
