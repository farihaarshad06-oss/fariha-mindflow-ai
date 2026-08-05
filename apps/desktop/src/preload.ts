import { contextBridge, ipcRenderer } from 'electron';
import { shell, clipboard } from 'electron';
import type { IpcResult } from './ipc/contracts';

/**
 * Exposes a minimal, type-safe IPC bridge to the renderer process.
 *
 * SECURITY:
 * - contextIsolation: true — renderer cannot access Node.js or Electron directly
 * - nodeIntegration: false — no require() in renderer
 * - Only explicitly allow-listed channels are bridgeable
 * - Full secrets are NEVER included in responses
 * - All inputs validated in main-process handlers before reaching services
 */

function invoke(channel: string, ...args: unknown[]): Promise<IpcResult<unknown>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<unknown>>;
}

function on(channel: string, listener: (...args: unknown[]) => void): () => void {
  const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

const electronAPI = {
  getVersion: () => invoke('app:getVersion'),
  getPlatform: () => invoke('app:getPlatform'),
  getPaths: () => invoke('app:getPaths'),
  isDesktop: true,
  openStartupLogs: async () => {
    const res = await invoke('app:getPaths');
    if (res.ok && res.data && typeof (res.data as { logs?: unknown }).logs === 'string') {
      await shell.openPath((res.data as { logs: string }).logs);
    }
  },
  copyStartupDiagnostics: async () => {
    const res = await invoke('diagnostics:get');
    if (res.ok) clipboard.writeText(JSON.stringify(res.data, null, 2));
  },
  getSettings: () => invoke('settings:get'),
  updateSettings: (data: unknown) => invoke('settings:set', data),
  setSecret: (key: string, value: string) => invoke('secret:set', { key, value }),
  hasSecret: (key: string) => invoke('secret:has', key),
  deleteSecret: (key: string) => invoke('secret:delete', key),
  saveAudio: (fileName: string, arrayBuffer: ArrayBuffer) => invoke('audio:save', fileName, arrayBuffer),
  listAudio: () => invoke('audio:list'),
  deleteAudio: (fileName: string) => invoke('audio:delete', fileName),
  startRecording: (opts: unknown) => invoke('recording:start', opts),
  pauseRecording: (sessionId: string) => invoke('recording:pause', sessionId),
  resumeRecording: (sessionId: string) => invoke('recording:resume', sessionId),
  stopRecording: (sessionId: string) => invoke('recording:stop', sessionId),
  getActiveRecording: (lectureId: string) => invoke('recording:getActive', lectureId),
  saveAudioChunk: (opts: unknown) => invoke('recording:chunkSave', opts),
  checkDiskSpace: () => invoke('recording:checkDisk'),
  listCourses: () => invoke('course:list'),
  getCourse: (id: string) => invoke('course:get', id),
  createCourse: (data: unknown) => invoke('course:create', data),
  updateCourse: (id: string, data: unknown) => invoke('course:update', id, data),
  deleteCourse: (id: string) => invoke('course:delete', id),
  listLectures: (courseId?: string) => invoke('lecture:list', courseId),
  getLecture: (id: string) => invoke('lecture:get', id),
  createLecture: (data: unknown) => invoke('lecture:create', data),
  updateLecture: (id: string, data: unknown) => invoke('lecture:update', id, data),
  deleteLecture: (id: string) => invoke('lecture:delete', id),
  listTranscript: (lectureId: string) => invoke('transcript:list', lectureId),
  editTranscriptSegment: (data: unknown) => invoke('transcript:editSegment', data),
  listModels: () => invoke('model:list'),
  downloadModel: (data: unknown) => invoke('model:downloadStart', data),
  cancelDownload: (modelId: string) => invoke('model:downloadCancel', modelId),
  deleteModel: (modelId: string) => invoke('model:delete', modelId),
  listJobs: (filter?: unknown) => invoke('job:list', filter),
  cancelJob: (jobId: string) => invoke('job:cancel', jobId),
  listProviders: () => invoke('provider:list'),
  upsertProvider: (data: unknown) => invoke('provider:upsert', data),
  deleteProvider: (id: string) => invoke('provider:delete', id),
  testProvider: (id: string) => invoke('provider:test', id),
  getUsageSummary: (opts?: unknown) => invoke('usage:summary', opts),
  listFlashcards: (courseId?: string) => invoke('flashcard:list', courseId),
  reviewFlashcard: (data: unknown) => invoke('flashcard:review', data),
  getChatHistory: (courseId?: string) => invoke('chat:history', courseId),
  sendChatMessage: (data: unknown) => invoke('chat:send', data),
  listQuizzes: (courseId?: string) => invoke('quiz:list', courseId),
  submitQuiz: (data: unknown) => invoke('quiz:submit', data),
  getDiagnostics: () => invoke('diagnostics:get'),
  onModelDownloadProgress: (
    listener: (data: { modelId: string; downloaded: number; total: number }) => void
  ) => on('model:downloadProgress', listener as (...args: unknown[]) => void),
  onRecordingError: (
    listener: (data: { sessionId: string; code: string; message: string }) => void
  ) => on('recording:error', listener as (...args: unknown[]) => void),
  onLiveTranscript: (
    listener: (data: {
      lectureId: string;
      segments: Array<{ segmentIndex: number; text: string; timestampStart: number; timestampEnd: number }>;
      chunkIndex?: number;
      partial: boolean;
    }) => void
  ) => on('transcript:live', listener as (...args: unknown[]) => void),
} satisfies Record<string, unknown>;

try {
  console.log('[preload] Initialising preload bridge');
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  console.log('[preload] electronAPI exposed');
  void ipcRenderer.invoke('diagnostics:startupEvent', {
    stage: 'preload',
    event: 'bridge-exposed',
  }).catch(() => undefined);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error('[preload] Failed to expose electronAPI', error);
  void ipcRenderer.invoke('diagnostics:startupFailure', {
    title: 'Preload Initialisation Failed',
    message,
    stack,
    stage: 'preload',
  }).catch(() => undefined);
  throw error;
}
