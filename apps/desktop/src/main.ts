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

// ── Diagnostic screen ──────────────────────────────────────────────────────
/**
 * Loads an inline HTML diagnostic page into the given window so the user
 * always sees a readable error instead of a blank white screen.
 */
function showDiagnosticScreen(win: BrowserWindow | null, title: string, message: string): void {
  if (!win || win.isDestroyed()) return;
  const logPath = log.transports.file.getFile?.()?.path ?? 'See electron-log file';
  const escapedTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapedMessage = message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapedLogPath = logPath.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Startup Error — Fariha MindFlow AI</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#fff;color:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem}
    .card{max-width:640px;width:100%}
    h1{color:#b91c1c;font-size:1.5rem;margin-bottom:.5rem}
    p{color:#374151;margin-bottom:1rem;line-height:1.5}
    pre{background:#f3f4f6;border-radius:6px;padding:1rem;overflow-x:auto;font-size:.78rem;white-space:pre-wrap;word-break:break-all;margin-bottom:1rem}
    .actions{display:flex;gap:.75rem;flex-wrap:wrap}
    button{padding:.5rem 1.25rem;border:none;border-radius:6px;cursor:pointer;font-size:.9rem}
    .reload{background:#2563eb;color:#fff}
    .copy{background:#e5e7eb;color:#111}
  </style>
</head>
<body>
  <div class="card">
    <h1>&#9888; ${escapedTitle}</h1>
    <p>The application encountered an error during startup. Please reload or check the log file.</p>
    <pre id="details">${escapedMessage}\n\nLog file: ${escapedLogPath}</pre>
    <div class="actions">
      <button class="reload" onclick="location.reload()">&#8635; Reload</button>
      <button class="copy" onclick="navigator.clipboard.writeText(document.getElementById('details').textContent).catch(()=>{})">&#128203; Copy diagnostics</button>
    </div>
  </div>
</body>
</html>`;
  win.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).catch((err: unknown) => {
    log.error('[main] Failed to load diagnostic screen:', err instanceof Error ? err.message : String(err));
  });
  win.show();
}

// ── Window management ──────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
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

  // ── Renderer process crash → show diagnostic screen instead of blank window ──
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log.error(`[main] Renderer process gone: reason=${details.reason} exitCode=${details.exitCode}`);
    showDiagnosticScreen(
      mainWindow,
      'Renderer Crash',
      `The renderer process terminated unexpectedly.\nReason: ${details.reason}\nExit code: ${details.exitCode}`,
    );
  });

  // ── Load lifecycle ──────────────────────────────────────────────────────
  mainWindow.webContents.on('did-finish-load', () => {
    log.info('[main] Renderer did-finish-load ✓');
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log.error(`[main] Renderer did-fail-load: code=${errorCode} desc="${errorDescription}" url="${validatedURL}"`);
    // Open DevTools automatically in dev builds, or when MINDFLOW_DEVTOOLS=1 is set,
    // so developers can inspect what went wrong without needing a re-build.
    if (isDev || process.env.MINDFLOW_DEVTOOLS === '1') {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    }
    showDiagnosticScreen(
      mainWindow,
      'Page Load Failed',
      `Failed to load the application.\nError ${errorCode}: ${errorDescription}\nURL: ${validatedURL}`,
    );
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const webRoot = resolveWebRoot();
    const indexHtml = path.join(webRoot, 'index.html');
    log.info(`[main] Loading renderer from: ${indexHtml}`);

    // Verify the file exists before loading so we surface a clear error.
    if (!fs.existsSync(indexHtml)) {
      log.error(`[main] index.html NOT FOUND at: ${indexHtml}`);
      dialog.showErrorBox(
        'Renderer Missing',
        `index.html was not found at the expected location:\n${indexHtml}\n\nThe application cannot start.`
      );
      app.quit();
      return;
    }

    mainWindow.loadFile(indexHtml).catch((err: unknown) => {
      log.error('[main] loadFile error:', err instanceof Error ? err.message : String(err));
    });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
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
}

// ── App lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(async () => {
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
    await initDatabase();

    log.info('[main] Registering IPC handlers...');
    registerAllHandlers();

    log.info('[main] Running startup recovery...');
    await RecordingService.recoverCrashedSessions();
    await JobQueue.recoverStalledJobs();
    await WhisperModelManager.ensureDefaults();

    log.info('[main] Starting Whisper worker...');
    WhisperWorker.start();
    WhisperWorker.startLiveTick();

    log.info('[main] Applying settings...');
    await SettingsService.get(); // ensure defaults exist

    createWindow();
    log.info('[main] Ready');
  } catch (err) {
    log.error('[main] Startup error:', err instanceof Error ? err.message : String(err));
    dialog.showErrorBox('Startup Error', `Failed to initialise MindFlow AI:\n${err instanceof Error ? err.message : String(err)}`);
    app.quit();
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
