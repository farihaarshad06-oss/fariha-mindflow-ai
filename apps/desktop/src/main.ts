import { app, BrowserWindow, shell, dialog, ipcMain, protocol } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// ESM shim for __dirname in CommonJS compiled output
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Constants ──────────────────────────────────────────────────────────────
const isDev = !app.isPackaged;
const WEB_DEV_URL = 'http://localhost:5173';

// In production the web build is embedded as an extraResource under `web/`
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
    minWidth: 800,
    minHeight: 600,
    title: 'Fariha MindFlow AI',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Allow local file access for audio playback when offline
      webSecurity: !isDev,
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL(WEB_DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Register a custom protocol so the web app can load relative assets
    const webRoot = resolveWebRoot();
    mainWindow.loadFile(path.join(webRoot, 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open external links in the OS default browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── App lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Register file:// protocol with correct MIME types for the web build
  if (!isDev) {
    protocol.registerFileProtocol('file', (request, callback) => {
      const filePath = decodeURIComponent(request.url.replace('file:///', ''));
      callback({ path: filePath });
    });
  }

  createWindow();

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

// ── IPC: local audio file storage ─────────────────────────────────────────
// Allows the renderer to save/load audio blobs to the user's app data folder.
// This keeps all data offline — nothing is sent to any server.

const userDataPath = app.getPath('userData');
const audioDir = path.join(userDataPath, 'audio');

ipcMain.handle('audio:save', async (_event, fileName: string, arrayBuffer: ArrayBuffer) => {
  try {
    fs.mkdirSync(audioDir, { recursive: true });
    const filePath = path.join(audioDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('audio:list', async () => {
  try {
    fs.mkdirSync(audioDir, { recursive: true });
    const files = fs.readdirSync(audioDir).map((name) => ({
      name,
      path: path.join(audioDir, name),
      size: fs.statSync(path.join(audioDir, name)).size,
      createdAt: fs.statSync(path.join(audioDir, name)).birthtime.toISOString(),
    }));
    return { success: true, files };
  } catch (err) {
    return { success: false, error: String(err), files: [] };
  }
});

ipcMain.handle('audio:delete', async (_event, fileName: string) => {
  try {
    const filePath = path.join(audioDir, fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('audio:openDialog', async () => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Audio File',
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'mp4', 'webm', 'ogg'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  const filePath = result.filePaths[0]!;
  const stat = fs.statSync(filePath);
  return {
    canceled: false,
    filePath,
    fileName: path.basename(filePath),
    size: stat.size,
  };
});

ipcMain.handle('app:getVersion', () => app.getVersion());
ipcMain.handle('app:getPlatform', () => process.platform);
ipcMain.handle('app:isOffline', () => !isDev);
