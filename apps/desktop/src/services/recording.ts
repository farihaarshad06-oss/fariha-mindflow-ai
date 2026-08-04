/**
 * RecordingService — manages recording sessions and audio chunks.
 *
 * Audio data arrives from the renderer via IPC as ArrayBuffer (WebM/Opus chunks).
 * Each chunk is written atomically to disk, checksummed, and persisted in SQLite.
 *
 * Features:
 * - 5-minute chunk rotation
 * - Crash recovery: on startup, any ACTIVE session with complete chunks is recoverable
 * - Disk space monitoring before each write
 * - Microphone disconnect detection (renderer sends an error event)
 * - Privacy mode: chunks are written but not transcribed automatically
 */

import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import log from 'electron-log/main';
import { getPrisma } from './database';
import { SettingsService } from './settings';
import { JobQueue } from './jobQueue';
import type { RecordingSession, AudioChunk } from '../generated/prisma';

export const CHUNK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const MIN_FREE_BYTES = 100 * 1024 * 1024; // 100 MB minimum free space

async function getAudioDir(): Promise<string> {
  const base = await SettingsService.getStoragePath();
  const dir = path.join(base, 'audio');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function checkDiskSpace(dir: string): Promise<{ freeBytes: number; ok: boolean }> {
  try {
    const { execSync } = await import('node:child_process');
    if (process.platform === 'win32') {
      const drive = path.parse(dir).root.replace(/\\/g, '');
      const out = execSync(`wmic logicaldisk where "DeviceID='${drive}'" get FreeSpace /format:value`, { timeout: 3000 }).toString();
      const match = /FreeSpace=(\d+)/.exec(out);
      const freeBytes = match ? parseInt(match[1] ?? '0', 10) : 0;
      return { freeBytes, ok: freeBytes >= MIN_FREE_BYTES };
    } else {
      const { statfsSync } = fs as typeof fs & { statfsSync?: (p: string) => { bfree: number; bsize: number } };
      if (statfsSync) {
        const s = statfsSync(dir);
        const freeBytes = s.bfree * s.bsize;
        return { freeBytes, ok: freeBytes >= MIN_FREE_BYTES };
      }
    }
  } catch (err) {
    log.warn('[recording] disk-check failed:', err instanceof Error ? err.message : String(err));
  }
  return { freeBytes: -1, ok: true }; // optimistic if check fails
}

export const RecordingService = {
  async startSession(opts: {
    lectureId: string;
    microphoneId?: string;
    microphoneName?: string;
    privacyMode?: boolean;
  }): Promise<RecordingSession> {
    const db = getPrisma();

    // Ensure no duplicate active session for this lecture
    const existing = await db.recordingSession.findUnique({ where: { lectureId: opts.lectureId } });
    if (existing && existing.state === 'ACTIVE') {
      log.warn('[recording] Session already active for lecture', opts.lectureId);
      return existing;
    }

    const session = existing
      ? await db.recordingSession.update({
          where: { id: existing.id },
          data: { state: 'ACTIVE', startedAt: new Date(), pausedAt: null, stoppedAt: null },
        })
      : await db.recordingSession.create({
          data: {
            lectureId: opts.lectureId,
            microphoneId: opts.microphoneId,
            microphoneName: opts.microphoneName,
            privacyMode: opts.privacyMode ?? false,
            state: 'ACTIVE',
          },
        });

    await db.lecture.update({ where: { id: opts.lectureId }, data: { state: 'RECORDING' } });
    log.info('[recording] Session started:', session.id);
    return session;
  },

  async pauseSession(sessionId: string): Promise<RecordingSession> {
    const db = getPrisma();
    const session = await db.recordingSession.update({
      where: { id: sessionId },
      data: { state: 'PAUSED', pausedAt: new Date() },
    });
    log.info('[recording] Paused:', sessionId);
    return session;
  },

  async resumeSession(sessionId: string): Promise<RecordingSession> {
    const db = getPrisma();
    const session = await db.recordingSession.update({
      where: { id: sessionId },
      data: { state: 'ACTIVE', pausedAt: null },
    });
    log.info('[recording] Resumed:', sessionId);
    return session;
  },

  async stopSession(sessionId: string): Promise<RecordingSession> {
    const db = getPrisma();
    const session = await db.recordingSession.findUniqueOrThrow({ where: { id: sessionId } });

    const updated = await db.recordingSession.update({
      where: { id: sessionId },
      data: { state: 'STOPPED', stoppedAt: new Date() },
    });

    await db.lecture.update({ where: { id: session.lectureId }, data: { state: 'PROCESSING' } });

    // Enqueue transcription job unless privacy mode
    if (!session.privacyMode) {
      await JobQueue.enqueue({
        jobType: 'TRANSCRIBE',
        payload: { lectureId: session.lectureId, sessionId },
        priority: 3,
      });
    }

    log.info('[recording] Stopped:', sessionId);
    return updated;
  },

  async saveChunk(opts: {
    sessionId: string;
    lectureId: string;
    index: number;
    data: Buffer;
    durationMs: number;
    startOffsetMs: number;
  }): Promise<AudioChunk> {
    const db = getPrisma();
    const audioDir = await getAudioDir();

    // Disk space check
    const { ok: spaceOk, freeBytes } = await checkDiskSpace(audioDir);
    if (!spaceOk) {
      log.error(`[recording] Insufficient disk space: ${freeBytes} bytes free`);
      throw new Error(`INSUFFICIENT_DISK_SPACE: ${freeBytes} bytes free`);
    }

    const fileName = `${opts.lectureId}-chunk-${String(opts.index).padStart(4, '0')}.webm`;
    const filePath = path.join(audioDir, fileName);

    // Atomic write: write to .tmp then rename
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, opts.data);
    fs.renameSync(tmpPath, filePath);

    const checksum = sha256(opts.data);

    const chunk = await db.audioChunk.upsert({
      where: { sessionId_index: { sessionId: opts.sessionId, index: opts.index } },
      create: {
        sessionId: opts.sessionId,
        lectureId: opts.lectureId,
        index: opts.index,
        filePath,
        fileSizeBytes: opts.data.length,
        durationMs: opts.durationMs,
        startOffsetMs: opts.startOffsetMs,
        state: 'COMPLETE',
        checksum,
        completedAt: new Date(),
      },
      update: {
        filePath,
        fileSizeBytes: opts.data.length,
        durationMs: opts.durationMs,
        state: 'COMPLETE',
        checksum,
        completedAt: new Date(),
      },
    });

    // Update session totals
    await db.recordingSession.update({
      where: { id: opts.sessionId },
      data: {
        chunkCount: { increment: 1 },
        totalDurationMs: { increment: opts.durationMs },
      },
    });

    log.info(`[recording] Chunk ${opts.index} saved: ${fileName} (${opts.data.length} bytes)`);
    return chunk;
  },

  async getActiveSession(lectureId: string): Promise<RecordingSession | null> {
    const db = getPrisma();
    return db.recordingSession.findFirst({
      where: { lectureId, state: { in: ['ACTIVE', 'PAUSED'] } },
    });
  },

  /** On app startup: mark crashed sessions and re-queue recovery */
  async recoverCrashedSessions(): Promise<void> {
    const db = getPrisma();
    const crashed = await db.recordingSession.findMany({
      where: { state: 'ACTIVE' },
    });
    for (const session of crashed) {
      await db.recordingSession.update({
        where: { id: session.id },
        data: { state: 'CRASHED', crashedAt: new Date() },
      });
      log.warn('[recording] Marked crashed session:', session.id);

      // Check if there are complete chunks to recover
      const chunkCount = await db.audioChunk.count({
        where: { sessionId: session.id, state: 'COMPLETE' },
      });
      if (chunkCount > 0 && !session.privacyMode) {
        await JobQueue.enqueue({
          jobType: 'TRANSCRIBE',
          payload: {
            lectureId: session.lectureId,
            sessionId: session.id,
            recovered: true,
          },
          priority: 4,
          deduplicate: true,
        });
        await db.recordingSession.update({
          where: { id: session.id },
          data: { state: 'RECOVERED', recoveredAt: new Date() },
        });
        log.info(`[recording] Enqueued recovery transcription for session ${session.id} (${chunkCount} chunks)`);
      }
    }
  },

  async checkDiskSpace(): Promise<{ freeBytes: number; ok: boolean }> {
    const audioDir = await getAudioDir();
    return checkDiskSpace(audioDir);
  },
};
