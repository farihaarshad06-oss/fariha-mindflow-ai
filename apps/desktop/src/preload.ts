import { contextBridge, ipcRenderer } from 'electron';

/**
 * Exposes a minimal, type-safe API to the renderer process (web app).
 * Nothing in `electron` or `node` is exposed directly — only explicit
 * allow-listed methods are bridged.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /** Save an audio blob to the local userData/audio folder. */
  saveAudio: (fileName: string, arrayBuffer: ArrayBuffer) =>
    ipcRenderer.invoke('audio:save', fileName, arrayBuffer),

  /** List all saved audio files in the local audio folder. */
  listAudio: () => ipcRenderer.invoke('audio:list'),

  /** Delete a saved audio file by name. */
  deleteAudio: (fileName: string) => ipcRenderer.invoke('audio:delete', fileName),

  /** Open a native OS file-picker dialog and return the selected file path. */
  openAudioDialog: () => ipcRenderer.invoke('audio:openDialog'),

  /** Return the Electron app version string. */
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  /** Return the current OS platform string (win32 / darwin / linux). */
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),

  /** Whether the app is running as a packaged desktop build (offline mode). */
  isOffline: () => ipcRenderer.invoke('app:isOffline'),
});
