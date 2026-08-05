import { app, BrowserWindow, shell, dialog, protocol } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import log from 'electron-log/main';
import { initDatabase, closeDatabase } from './services/database';
import { registerAllHandlers } from './ipc/handlers';
import { RecordingService } from './services/recording';
import { JobQueue } from './services/jobQueue';
import { WhisperModelManager } from './services/whisperModels';
import { WhisperWorker } from './services/whisperWorker';
import { SettingsService } from './services/settings';
import { recordStartupEvent, markStartupFailure, writeStartupDiagnostics, getStartupDiagnosticsPath, type StartupFailurePayload } from './startupDiagnostics';

// ── Logging ────────────────────────────────────────────────────────────────
log.initialize();
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Redact potential secrets from logs
log.transports.file.transforms.push((msg) => {
  // msg.data may not be an array in all electron-log versions/contexts
  if (!Array.isArray(msg.data)) return msg;
  const parts = msg.data.map((d: unknown) => {
    if (typeof d !== 'string') return d;
    return d.replace(/Bearer\s+\S+/gi, '******')
            .replace(/"(key|secret|token|password|apiKey)"\s*:\s*"[^"]+"/gi, '"$1":"[REDACTED]"');
  });
  return { ...msg, data: parts };
});

// ── Constants ──────────────────────────────────────────────────────────────
const isDev = !app.isPackaged;
recordStartupEvent('boot', 'process-start', { isDev });

function resolveWebRoot(): string {
  const webRoot = path.join(process.resourcesPath, 'web');
  log.info(`[main] resolveWebRoot → ${webRoot}`);
  return webRoot;
}

// ── Single-instance lock ───────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// ── Window management ──────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let startupFailureWindowShown = false;

function renderStartupFailureHtml(payload: StartupFailurePayload): string {
  const esc = (value: string | undefined) =>
    (value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html>
  <html><head><meta charset="utf-8" /><title>MindFlow AI Startup Error</title>
  <style>
  body{font-family:Segoe UI,system-ui,sans-serif;background:#111827;color:#f9fafb;margin:0;padding:24px}
  .card{max-width:980px;margin:0 auto;background:#1f2937;border-radius:12px;padding:24px}
  h1{margin-top:0;color:#fca5a5}.muted{color:#cbd5e1}.meta{margin:16px 0;padding:12px;background:#111827;border-radius:8px}
  pre{white-space:pre-wrap;word-break:break-word;background:#0f172a;padding:16px;border-radius:8px;overflow:auto}
  .actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:20px}button{background:#2563eb;color:#fff;border:0;border-radius:8px;padding:10px 16px;cursor:pointer}
  </style></head><body><div class="card">
  <h1>${esc(payload.title)}</h1>
  <p>${esc(payload.message)}</p>
  <div class="meta"><div><strong>Startup stage:</strong> ${esc(payload.stage)}</div><div><strong>Diagnostics:</strong> ${esc(payload.diagnosticsPath)}</div></div>
  <pre>${esc(payload.stack)}</pre>
  <div class="actions">
    <button onclick="window.location.reload()">Reload</button>
    <button onclick="window.electronAPI?.openStartupLogs?.()">Open logs</button>
    <button onclick="window.electronAPI?.copyStartupDiagnostics?.()">Copy diagnostics</button>
  </div>
  </div></body></html>`;
}

async function showStartupFailure(payload: StartupFailurePayload): Promise<void> {
  startupFailureWindowShown = true;
  writeStartupDiagnostics();
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = new BrowserWindow({
      width: 1100,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'Fariha MindFlow AI — Startup Error',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
      show: false,
    });
  }
  mainWindow.webContents.once('did-finish-load', () => mainWindow?.show());
  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderStartupFailureHtml(payload))}`);
}

function createWindow(): void {
  recordStartupEvent('window-create', 'browser-window-create:start', {
    preload: path.join(__dirname, 'preload.js'),
  });
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Fariha MindFlow AI',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    show: false,
  });

  // ── Renderer console errors ─────────────────────────────────────────────
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelName = ['verbose', 'info', 'warning', 'error'][level] ?? 'unknown';
    log.info(`[renderer:${levelName}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    const failure = markStartupFailure({
      title: 'Renderer Process Crashed',
      message: `Renderer process exited during startup: ${details.reason}`,
      stage: 'renderer-load',
      stack: JSON.stringify(details),
    });
    void showStartupFailure(failure);
  });
  mainWindow.webContents.on('did-start-loading', () => recordStartupEvent('renderer-load', 'did-start-loading'));
  mainWindow.webContents.on('did-stop-loading', () => recordStartupEvent('renderer-load', 'did-stop-loading'));
  mainWindow.webContents.on('did-fail-provisional-load', (_event, errorCode, errorDescription, validatedURL) => {
    const failure = markStartupFailure({
      title: 'Navigation Failed',
      message: errorDescription,
      stage: 'renderer-load',
      stack: `code=${errorCode} url=${validatedURL}`,
    });
    void showStartupFailure(failure);
  });
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    const failure = markStartupFailure({
      title: 'Preload Script Failed',
      message: `Preload execution failed: ${preloadPath}`,
      stage: 'preload',
      stack: error?.stack ?? String(error),
    });
    void showStartupFailure(failure);
  });

  // ── Load lifecycle ──────────────────────────────────────────────────────
  mainWindow.webContents.on('did-finish-load', () => {
    log.info('[main] Renderer did-finish-load ✓');
    recordStartupEvent('renderer-load', 'did-finish-load');
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log.error(`[main] Renderer did-fail-load: code=${errorCode} desc="${errorDescription}" url="${validatedURL}"`);
    const failure = markStartupFailure({
      title: 'Renderer Failed to Load',
      message: errorDescription,
      stage: 'renderer-load',
      stack: `code=${errorCode} url=${validatedURL}`,
    });
    void showStartupFailure(failure);
    // Open DevTools automatically in dev builds, or when MINDFLOW_DEVTOOLS=1 is set,
    // so developers can inspect what went wrong without needing a re-build.
    if (isDev || process.env.MINDFLOW_DEVTOOLS === '1') {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    }
  });

  if (isDev) {
    recordStartupEvent('renderer-load', 'loadURL', { url: 'http://localhost:5173' });
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const webRoot = resolveWebRoot();
    const indexHtml = path.join(webRoot, 'index.html');
    log.info(`[main] Loading renderer from: ${indexHtml}`);

    // Verify the file exists before loading so we surface a clear error.
    if (!fs.existsSync(indexHtml)) {
      log.error(`[main] index.html NOT FOUND at: ${indexHtml}`);
      const failure = markStartupFailure({
        title: 'Renderer Missing',
        message: `index.html was not found at the expected location:\n${indexHtml}`,
        stage: 'renderer-load',
        stack: `diagnostics=${getStartupDiagnosticsPath()}`,
      });
      void showStartupFailure(failure);
      return;
    }

    recordStartupEvent('renderer-load', 'loadFile', { indexHtml });
    mainWindow.loadFile(indexHtml).catch((err: unknown) => {
      log.error('[main] loadFile error:', err instanceof Error ? err.message : String(err));
      const failure = markStartupFailure({
        title: 'Renderer Load Error',
        message: err instanceof Error ? err.message : String(err),
        stage: 'renderer-load',
        stack: err instanceof Error ? err.stack : undefined,
      });
      void showStartupFailure(failure);
    });
  }

  mainWindow.once('ready-to-show', () => {
    if (!startupFailureWindowShown) {
      mainWindow?.show();
    }
  });

  // Open external links in OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        return { action: 'deny' };
      }
    } catch {
      return { action: 'deny' };
    }
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  recordStartupEvent('window-create', 'browser-window-create:complete');
}

// ── App lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  recordStartupEvent('app-ready', 'app.whenReady');
  if (!isDev) {
    protocol.registerFileProtocol('file', (request, callback) => {
      // Use fileURLToPath for correct cross-platform decoding of file:// URLs
      // (avoids the regex strip that breaks Windows drive letters, e.g. file:///C:/...).
      try {
        const filePath = fileURLToPath(request.url);
        callback({ path: filePath });
      } catch (err) {
        log.error('[protocol:file] Failed to decode URL:', request.url, err instanceof Error ? err.message : String(err));
        callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
      }
    });
  }

  try {
    log.info('[main] Initialising database...');
    recordStartupEvent('database-init', 'start');
    await initDatabase();
    recordStartupEvent('database-init', 'complete');

    log.info('[main] Registering IPC handlers...');
    recordStartupEvent('ipc-registration', 'start');
    registerAllHandlers();
    recordStartupEvent('ipc-registration', 'complete');

    log.info('[main] Running startup recovery...');
    recordStartupEvent('startup-recovery', 'start');
    await RecordingService.recoverCrashedSessions();
    await JobQueue.recoverStalledJobs();
    await WhisperModelManager.ensureDefaults();
    recordStartupEvent('startup-recovery', 'complete');

    log.info('[main] Starting Whisper worker...');
    recordStartupEvent('worker-start', 'start');
    WhisperWorker.start();
    WhisperWorker.startLiveTick();
    recordStartupEvent('worker-start', 'complete');

    log.info('[main] Applying settings...');
    recordStartupEvent('settings-init', 'start');
    await SettingsService.get(); // ensure defaults exist
    recordStartupEvent('settings-init', 'complete');

    createWindow();
    log.info('[main] Ready');
    recordStartupEvent('ready', 'startup-complete', { diagnosticsPath: writeStartupDiagnostics() });
  } catch (err) {
    log.error('[main] Startup error:', err instanceof Error ? err.message : String(err));
    const failure = markStartupFailure({
      title: 'Startup Error',
      message: `Failed to initialise MindFlow AI:\n${err instanceof Error ? err.message : String(err)}`,
      stage: 'boot',
      stack: err instanceof Error ? err.stack : undefined,
    });
    void showStartupFailure(failure);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  log.info('[main] Shutting down...');
  WhisperWorker.stop();
  await closeDatabase();
});

process.on('uncaughtException', (error) => {
  const failure = markStartupFailure({
    title: 'Uncaught Exception',
    message: error.message,
    stage: 'boot',
    stack: error.stack,
  });
  void showStartupFailure(failure);
});

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  const failure = markStartupFailure({
    title: 'Unhandled Promise Rejection',
    message,
    stage: 'boot',
    stack,
  });
  void showStartupFailure(failure);
});
