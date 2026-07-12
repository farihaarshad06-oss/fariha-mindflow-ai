export const FILE_LIMITS = {
  maxAudioBytes: 500 * 1024 * 1024,
  maxDocumentBytes: 25 * 1024 * 1024,
  maxUploadBytes: 500 * 1024 * 1024,
  allowedAudioMimeTypes: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav'] as const,
  allowedDocumentMimeTypes: ['application/pdf'] as const,
  allowedMimeTypes: [
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'application/pdf',
  ] as const,
  allowedAudioExtensions: ['webm', 'mp4', 'mp3', 'wav', 'm4a'] as const,
  allowedDocumentExtensions: ['pdf'] as const,
  maxRecordingSeconds: 3 * 60 * 60,
};

export const UPLOAD_PURPOSES = ['LECTURE_AUDIO', 'COURSE_DOCUMENT'] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];
