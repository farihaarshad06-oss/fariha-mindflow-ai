/**
 * Type declarations for the Electron preload bridge.
 * When running inside the desktop app window.electronAPI is defined.
 * In a regular browser it is undefined — always check before calling.
 */

export interface IpcResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface ElectronAPI {
  isDesktop: true;
  getVersion(): Promise<IpcResult<string>>;
  getPlatform(): Promise<IpcResult<string>>;
  getPaths(): Promise<IpcResult<{ userData: string; logs: string; temp: string }>>;
  getSettings(): Promise<IpcResult<Record<string, unknown>>>;
  updateSettings(data: Record<string, unknown>): Promise<IpcResult<Record<string, unknown>>>;
  setSecret(key: string, value: string): Promise<IpcResult<undefined>>;
  hasSecret(key: string): Promise<IpcResult<boolean>>;
  deleteSecret(key: string): Promise<IpcResult<undefined>>;
  saveAudio(fileName: string, arrayBuffer: ArrayBuffer): Promise<IpcResult<{ filePath: string }>>;
  listAudio(): Promise<IpcResult<{ files: Array<{ name: string; size: number; createdAt: string }> }>>;
  deleteAudio(fileName: string): Promise<IpcResult<undefined>>;
  startRecording(opts: { lectureId: string; microphoneId?: string; privacyMode?: boolean; language?: string }): Promise<IpcResult<unknown>>;
  pauseRecording(sessionId: string): Promise<IpcResult<unknown>>;
  resumeRecording(sessionId: string): Promise<IpcResult<unknown>>;
  stopRecording(sessionId: string): Promise<IpcResult<unknown>>;
  getActiveRecording(lectureId: string): Promise<IpcResult<unknown>>;
  saveAudioChunk(opts: { sessionId: string; lectureId: string; index: number; arrayBuffer: ArrayBuffer; durationMs: number; startOffsetMs: number }): Promise<IpcResult<unknown>>;
  checkDiskSpace(): Promise<IpcResult<{ freeBytes: number; ok: boolean }>>;
  listCourses(): Promise<IpcResult<unknown[]>>;
  getCourse(id: string): Promise<IpcResult<unknown>>;
  createCourse(data: { title: string; description?: string; color?: string; nextExamDate?: string }): Promise<IpcResult<unknown>>;
  updateCourse(id: string, data: Record<string, unknown>): Promise<IpcResult<unknown>>;
  deleteCourse(id: string): Promise<IpcResult<undefined>>;
  listLectures(courseId?: string): Promise<IpcResult<unknown[]>>;
  getLecture(id: string): Promise<IpcResult<unknown>>;
  createLecture(data: { courseId?: string; title: string; language?: string }): Promise<IpcResult<unknown>>;
  updateLecture(id: string, data: Record<string, unknown>): Promise<IpcResult<unknown>>;
  deleteLecture(id: string): Promise<IpcResult<undefined>>;
  listTranscript(lectureId: string): Promise<IpcResult<unknown[]>>;
  editTranscriptSegment(data: { segmentId: string; editedText: string }): Promise<IpcResult<unknown>>;
  listModels(): Promise<IpcResult<unknown[]>>;
  downloadModel(data: { modelId: string }): Promise<IpcResult<{ started: boolean }>>;
  cancelDownload(modelId: string): Promise<IpcResult<undefined>>;
  deleteModel(modelId: string): Promise<IpcResult<undefined>>;
  listJobs(filter?: { status?: string; jobType?: string }): Promise<IpcResult<unknown[]>>;
  cancelJob(jobId: string): Promise<IpcResult<undefined>>;
  listProviders(): Promise<IpcResult<unknown[]>>;
  upsertProvider(data: Record<string, unknown>): Promise<IpcResult<{ id: string }>>;
  deleteProvider(id: string): Promise<IpcResult<undefined>>;
  testProvider(id: string): Promise<IpcResult<unknown>>;
  getUsageSummary(opts?: { period?: 'daily' | 'monthly' }): Promise<IpcResult<unknown>>;
  listFlashcards(courseId?: string): Promise<IpcResult<unknown[]>>;
  reviewFlashcard(data: { flashcardId: string; quality: number }): Promise<IpcResult<unknown>>;
  getChatHistory(courseId?: string): Promise<IpcResult<unknown[]>>;
  sendChatMessage(data: { courseId?: string; message: string }): Promise<IpcResult<unknown>>;
  listQuizzes(courseId?: string): Promise<IpcResult<unknown[]>>;
  submitQuiz(data: { attemptId: string; answers: Array<{ questionId: string; answer: string }> }): Promise<IpcResult<unknown>>;
  getDiagnostics(): Promise<IpcResult<unknown>>;
  onModelDownloadProgress(listener: (data: { modelId: string; downloaded: number; total: number }) => void): () => void;
  onRecordingError(listener: (data: { sessionId: string; code: string; message: string }) => void): () => void;
  onLiveTranscript(listener: (data: { lectureId: string; partial: boolean; segments: Array<{ text: string }> }) => void): () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
