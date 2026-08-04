/**
 * Type declarations for the Electron preload bridge.
 *
 * `window.electronAPI` is defined only when the web app runs inside the
 * Fariha MindFlow AI desktop application.  In a regular browser it is
 * `undefined` — always guard with `if (window.electronAPI)` before calling.
 */

export interface AudioFileInfo {
  name: string;
  path: string;
  size: number;
  createdAt: string;
}

export interface AudioSaveResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface AudioListResult {
  success: boolean;
  files: AudioFileInfo[];
  error?: string;
}

export interface AudioDialogResult {
  canceled: boolean;
  filePath?: string;
  fileName?: string;
  size?: number;
}

export interface ElectronAPI {
  saveAudio(fileName: string, arrayBuffer: ArrayBuffer): Promise<AudioSaveResult>;
  listAudio(): Promise<AudioListResult>;
  deleteAudio(fileName: string): Promise<AudioSaveResult>;
  openAudioDialog(): Promise<AudioDialogResult>;
  getVersion(): Promise<string>;
  getPlatform(): Promise<string>;
  isOffline(): Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
