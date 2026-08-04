import { app, BrowserWindow, shell, dialog, protocol } from 'electron';
import path from 'node:path';
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
  return path.join(process.resourcesPath, 'web');
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

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const webRoot = resolveWebRoot();
    mainWindow.loadFile(path.join(webRoot, 'index.html'));
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
      const filePath = decodeURIComponent(request.url.replace('file:///', ''));
      callback({ path: filePath });
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
