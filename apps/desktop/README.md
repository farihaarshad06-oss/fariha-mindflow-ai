# Fariha MindFlow AI — Desktop App

Electron wrapper that packages the web app as an installable desktop application for Windows, macOS, and Linux. All data is stored locally — **no internet connection is required**.

## Quick start (development)

```bash
# From the monorepo root
pnpm install
pnpm --filter @mindflow/desktop dev
```

This starts the Vite dev server for the web app and opens an Electron window pointed at it.

## Building an installer

```bash
# Windows (NSIS installer — .exe)
pnpm --filter @mindflow/desktop build:win

# macOS (DMG — .dmg)
pnpm --filter @mindflow/desktop build:mac

# Linux (AppImage + .deb)
pnpm --filter @mindflow/desktop build:linux
```

Artifacts are written to `apps/desktop/dist-app/`.

## Architecture

| Layer | Details |
|---|---|
| **Main process** (`src/main.ts`) | Creates the `BrowserWindow`, registers IPC handlers for local audio file I/O, single-instance lock |
| **Preload** (`src/preload.ts`) | Exposes a safe `window.electronAPI` bridge via `contextBridge` |
| **Renderer** | The built `apps/web/dist/` bundle, loaded as a local file in production |

## Local-First Architecture

MindFlow AI follows a **local-first** design: every normal operation works completely offline. Cloud AI is called only for the five features that genuinely require AI reasoning.

### Feature locality map

| Feature | Locality | Notes |
|---|---|---|
| Audio recording (start/pause/resume/stop) | **LOCAL** | WebM/Opus chunks written directly to disk |
| Waveform & timer | **LOCAL** | Renderer-side only |
| Microphone detection & device selection | **LOCAL** | MediaDevices API |
| Speech-to-text / transcription | **LOCAL** | On-device whisper.cpp via `nodejs-whisper` |
| Live transcript streaming | **LOCAL** | Chunks processed by local Whisper every 2–5 s |
| Courses & lectures (CRUD) | **LOCAL** | SQLite + Prisma |
| Transcript viewing & editing | **LOCAL** | SQLite |
| Full-text search | **LOCAL** | SQLite FTS5 / BM25 |
| Notes | **LOCAL** | SQLite |
| Settings & privacy mode | **LOCAL** | SQLite |
| Backup & restore | **LOCAL** | ZIP export/import |
| Playback | **LOCAL** | Local audio files |
| Flashcard review (SM-2) | **LOCAL** | Spaced-repetition computed in-process |
| **Generate Summary** | **AI_REQUIRED** | Returns `AI_NOT_CONFIGURED` when no key set |
| **Generate Flashcards** | **AI_REQUIRED** | Returns `AI_NOT_CONFIGURED` when no key set |
| **Generate Quiz** | **AI_REQUIRED** | Returns `AI_NOT_CONFIGURED` when no key set |
| **Study Assistant Chat** | **AI_REQUIRED** | Returns `AI_NOT_CONFIGURED` when no key set |
| **Study Recommendations** | **AI_REQUIRED** | Returns `AI_NOT_CONFIGURED` when no key set |

### AI service layer

All AI calls flow through a single `AIService` boundary:

```
Renderer  →  IPC (contracts.ts)  →  isAiConfigured()  →  learning.ts  →  aiProviders.ts
                                          ↓ false
                               err({ code: 'AI_NOT_CONFIGURED' })
```

No component may call `aiRequest()` directly. Every AI IPC handler checks `isAiConfigured()` first and returns a structured error when no provider key is stored.  The application is fully usable with **zero AI provider configured**.

### Security

- API keys are stored exclusively in the OS keychain via `safeStorage` (Electron) — never in SQLite, never logged.
- AI is silently disabled when no key exists; the user sees a "Configure AI Provider" prompt.
- All local Whisper transcription runs in-process — no audio is uploaded to any cloud service.



- The web build is embedded inside the installer as a static asset (`extraResources/web/`).
- All lecture/course data is persisted in `localStorage` (IndexedDB for binary audio).
- The `window.electronAPI.saveAudio` / `listAudio` / `deleteAudio` IPC calls store audio files in the OS user-data folder (`%APPDATA%/Fariha MindFlow AI/audio` on Windows, `~/Library/Application Support/…` on macOS, `~/.config/…` on Linux).
- No external network calls are made in the packaged build.

## Audio file upload

The recorder page supports two upload methods when running in the browser:
1. **Drag-and-drop** — drop an audio file onto the upload zone.
2. **File picker** — click the "Upload audio file" button.

When running inside the desktop app, `window.electronAPI.openAudioDialog()` also triggers a native OS file-open dialog.

Supported formats: `MP3`, `WAV`, `M4A`, `MP4`, `WebM` — up to **500 MB**.
