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

## Offline operation

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
