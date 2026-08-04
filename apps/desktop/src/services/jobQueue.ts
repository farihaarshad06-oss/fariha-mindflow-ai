/**
 * JobQueue — persistent job queue backed by SQLite ProcessingJob table.
 *
 * Features:
 * - Atomic lock/claim with unique worker IDs
 * - Retry with exponential backoff
 * - Deduplication by jobType + payload hash
 * - Crash recovery: jobs left RUNNING by dead workers are re-queued on startup
 * - Cancellation
 */

import crypto from 'node:crypto';
import { getPrisma } from './database';
import log from 'electron-log/main';

export type JobType =
  | 'TRANSCRIBE'
  | 'SUMMARIZE'
  | 'FLASHCARDS'
  | 'QUIZ_GENERATE'
  | 'CLEANUP'
  | 'SEARCH_INDEX';

export interface EnqueueOptions {
  jobType: JobType;
  payload: Record<string, unknown>;
  priority?: number;
  maxRetries?: number;
  scheduledAfter?: Date;
  deduplicate?: boolean;
}

export interface JobRecord {
  id: string;
  jobType: string;
  status: string;
  priority: number;
  payload: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  errorCode?: string | null;
  safeErrorMessage?: string | null;
  lockedBy?: string | null;
  scheduledAfter: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function hashPayload(jobType: string, payload: Record<string, unknown>): string {
  const str = JSON.stringify({ jobType, payload });
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

const WORKER_ID = `w-${process.pid}-${Date.now()}`;

export const JobQueue = {
  /**
   * Enqueue a new job. If deduplicate=true and an identical PENDING job exists,
   * returns that job without creating a duplicate.
   */
  async enqueue(opts: EnqueueOptions): Promise<JobRecord> {
    const db = getPrisma();
    const {
      jobType,
      payload,
      priority = 5,
      maxRetries = 3,
      scheduledAfter = new Date(),
      deduplicate = true,
    } = opts;

    if (deduplicate) {
      const hash = hashPayload(jobType, payload);
      const existing = await db.processingJob.findFirst({
        where: {
          jobType,
          status: { in: ['PENDING', 'RUNNING'] },
          payload: { contains: hash },
        },
      });
      if (existing) {
        log.info(`[jobs] Deduplicated job ${jobType} (existing: ${existing.id})`);
        return this._toRecord(existing);
      }
    }

    const payloadWithHash = { ...payload, _hash: hashPayload(jobType, payload) };
    const job = await db.processingJob.create({
      data: {
        jobType,
        payload: JSON.stringify(payloadWithHash),
        priority,
        maxRetries,
        scheduledAfter,
        status: 'PENDING',
      },
    });
    log.info(`[jobs] Enqueued ${jobType} id=${job.id}`);
    return this._toRecord(job);
  },

  /**
   * Claim the next available job for this worker (atomic: status PENDING→RUNNING).
   */
  async claimNext(jobTypes?: JobType[]): Promise<JobRecord | null> {
    const db = getPrisma();
    const now = new Date();

    // Find and lock in a transaction
    return db.$transaction(async (tx) => {
      const job = await tx.processingJob.findFirst({
        where: {
          status: 'PENDING',
          scheduledAfter: { lte: now },
          ...(jobTypes ? { jobType: { in: jobTypes } } : {}),
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      });
      if (!job) return null;

      const updated = await tx.processingJob.update({
        where: { id: job.id, status: 'PENDING' },
        data: {
          status: 'RUNNING',
          lockedBy: WORKER_ID,
          lockedAt: now,
          startedAt: job.startedAt ?? now,
        },
      });
      return this._toRecord(updated);
    });
  },

  async complete(jobId: string): Promise<void> {
    const db = getPrisma();
    await db.processingJob.update({
      where: { id: jobId },
      data: { status: 'DONE', completedAt: new Date(), lockedBy: null },
    });
    log.info(`[jobs] Completed ${jobId}`);
  },

  async fail(jobId: string, errorCode: string, safeMessage: string): Promise<void> {
    const db = getPrisma();
    const job = await db.processingJob.findUnique({ where: { id: jobId } });
    if (!job) return;

    const nextRetry = job.retryCount + 1;
    if (nextRetry >= job.maxRetries) {
      await db.processingJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          retryCount: nextRetry,
          errorCode,
          safeErrorMessage: safeMessage,
          completedAt: new Date(),
          lockedBy: null,
        },
      });
      log.warn(`[jobs] Permanently failed ${jobId}: ${safeMessage}`);
    } else {
      // Exponential backoff: 30s, 2m, 8m, ...
      const backoffMs = 30_000 * Math.pow(4, nextRetry);
      const scheduledAfter = new Date(Date.now() + backoffMs);
      await db.processingJob.update({
        where: { id: jobId },
        data: {
          status: 'PENDING',
          retryCount: nextRetry,
          errorCode,
          safeErrorMessage: safeMessage,
          lockedBy: null,
          scheduledAfter,
        },
      });
      log.warn(`[jobs] Failed ${jobId} (retry ${nextRetry}/${job.maxRetries}), next at ${scheduledAfter.toISOString()}`);
    }
  },

  async cancel(jobId: string): Promise<void> {
    const db = getPrisma();
    await db.processingJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED', completedAt: new Date(), lockedBy: null },
    });
    log.info(`[jobs] Cancelled ${jobId}`);
  },

  /**
   * On startup, re-queue jobs that were left in RUNNING state by a crashed worker.
   */
  async recoverStalledJobs(): Promise<number> {
    const db = getPrisma();
    // Jobs running for more than 10 minutes are considered stalled
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
    const result = await db.processingJob.updateMany({
      where: {
        status: 'RUNNING',
        lockedAt: { lt: staleThreshold },
      },
      data: {
        status: 'PENDING',
        lockedBy: null,
        lockedAt: null,
      },
    });
    if (result.count > 0) {
      log.warn(`[jobs] Recovered ${result.count} stalled jobs`);
    }
    return result.count;
  },

  async list(filter?: { status?: string; jobType?: string }): Promise<JobRecord[]> {
    const db = getPrisma();
    const jobs = await db.processingJob.findMany({
      where: {
        ...(filter?.status ? { status: filter.status } : {}),
        ...(filter?.jobType ? { jobType: filter.jobType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return jobs.map(this._toRecord);
  },

  _toRecord(job: {
    id: string; jobType: string; status: string; priority: number;
    payload: string; retryCount: number; maxRetries: number;
    errorCode?: string | null; safeErrorMessage?: string | null;
    lockedBy?: string | null; scheduledAfter: Date; startedAt?: Date | null;
    completedAt?: Date | null; createdAt: Date; updatedAt: Date;
  }): JobRecord {
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(job.payload) as Record<string, unknown>; } catch { /* invalid payload */ }
    return { ...job, payload };
  },
};
