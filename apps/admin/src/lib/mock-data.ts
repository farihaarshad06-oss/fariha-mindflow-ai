import type { User, Lecture, ProcessingJob, AuditLog } from '@mindflow/types';

export const adminUsers: User[] = [
  {
    id: 'u-1',
    email: 'demo.student@mindflow.local',
    fullName: 'Demo Student',
    roles: ['STUDENT'],
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'u-2',
    email: 'admin@mindflow.local',
    fullName: 'Platform Admin',
    roles: ['PLATFORM_ADMIN'],
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 86400000 * 40).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const adminLectures: Lecture[] = [
  {
    id: 'l-1',
    ownerId: 'u-1',
    title: 'Principles of Bioethics',
    state: 'READY',
    durationSeconds: 1820,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'l-2',
    ownerId: 'u-1',
    title: 'Trees and Heaps',
    state: 'TRANSCRIBING',
    durationSeconds: 2400,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const adminJobs: ProcessingJob[] = [
  {
    id: 'j-1',
    jobType: 'TRANSCRIPTION',
    status: 'SUCCEEDED',
    retryCount: 0,
    maxRetries: 3,
    payload: {},
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  },
  {
    id: 'j-2',
    jobType: 'LECTURE_SUMMARY',
    status: 'FAILED',
    retryCount: 3,
    maxRetries: 3,
    errorCode: 'AI_PROVIDER_TIMEOUT',
    safeErrorMessage: 'Summary generation timed out and retries were exhausted.',
    diagnosticReference: 'diag-99',
    payload: {},
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const adminUsage = {
  transcriptionMinutes: 320,
  aiTokens: 184000,
  storageBytes: 512 * 1024 * 1024,
};

export const adminAuditLogs: AuditLog[] = [
  {
    id: 'a-1',
    actorId: 'u-1',
    actorType: 'USER',
    action: 'USER_REGISTERED',
    resource: 'user',
    resourceId: 'u-1',
    requestId: 'req-abc',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'a-2',
    actorType: 'WORKER',
    action: 'TRANSCRIPTION_COMPLETED',
    resource: 'lecture',
    resourceId: 'l-1',
    requestId: 'req-def',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];
