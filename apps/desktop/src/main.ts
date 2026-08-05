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
