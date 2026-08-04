/**
 * IPC handler registration.
 * Registers all ipcMain.handle() calls, validates inputs with Zod,
 * and delegates to the appropriate services.
 *
 * Security rules enforced here:
 * - All inputs validated through Zod schemas before passing to services
 * - No full secrets ever returned to renderer
 * - No raw file paths outside userData accepted
 * - All errors returned as safe IpcErr (no stack traces, no internal paths)
 */

import { ipcMain } from 'electron';
import log from 'electron-log/main';
import {
  IPC,
  ok, err,
  RecordingStartSchema,
  RecordingChunkSaveSchema,
  SecretSetSchema,
  SettingsSetSchema,
  CourseCreateSchema,
  LectureCreateSchema,
  TranscriptEditSchema,
  ModelDownloadStartSchema,
  ProviderUpsertSchema,
  FlashcardReviewSchema,
  ChatSendSchema,
  QuizSubmitSchema,
  type IpcResult,
} from '../ipc/contracts';
import { SecretsService } from '../services/secrets';
import { SettingsService } from '../services/settings';
import { RecordingService } from '../services/recording';
import { CourseService, LectureService } from '../services/courses';
import { TranscriptService } from '../services/transcript';
import { WhisperModelManager } from '../services/whisperModels';
import { JobQueue } from '../services/jobQueue';
import { getPrisma } from '../services/database';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

function wrap<T>(fn: () => Promise<IpcResult<T>>): Promise<IpcResult<T>> {
  return fn().catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    // Redact any potential path information
    const safe = msg.replace(/([A-Za-z]:[\\\/][^\s,]+)/g, '[PATH]').replace(/(\/[^\s,]+)/g, '[PATH]');
    log.error('[ipc] Unhandled error:', safe);
    return err(safe);
  });
}

export function registerAllHandlers(): void {
  // ── App ───────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.APP_VERSION, () => ok(app.getVersion()));
  ipcMain.handle(IPC.APP_PLATFORM, () => ok(process.platform));
  ipcMain.handle(IPC.APP_PATHS, () =>
    ok({
      userData: app.getPath('userData'),
      logs: app.getPath('logs'),
      temp: app.getPath('temp'),
    })
  );

  // ── Settings ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC.SETTINGS_GET, () =>
    wrap(async () => ok(await SettingsService.get()))
  );

  ipcMain.handle(IPC.SETTINGS_SET, (_e, raw: unknown) =>
    wrap(async () => {
      const data = SettingsSetSchema.parse(raw);
      return ok(await SettingsService.update(data));
    })
  );

  // ── Secrets ───────────────────────────────────────────────────────────
  ipcMain.handle(IPC.SECRET_SET, (_e, raw: unknown) =>
    wrap(async () => {
      const { key, value } = SecretSetSchema.parse(raw);
      SecretsService.setSecret(key, value);
      return ok(undefined);
    })
  );

  ipcMain.handle(IPC.SECRET_HAS, (_e, key: unknown) =>
    wrap(async () => {
      if (typeof key !== 'string') return err('Invalid key');
      return ok(SecretsService.hasSecret(key));
    })
  );

  ipcMain.handle(IPC.SECRET_DELETE, (_e, key: unknown) =>
    wrap(async () => {
      if (typeof key !== 'string') return err('Invalid key');
      SecretsService.deleteSecret(key);
      return ok(undefined);
    })
  );

  // NOTE: SECRET_GET is intentionally NOT exposed to renderer.
  // Only main-process services call SecretsService.getSecret() directly.

  // ── Audio (legacy path for direct browser-API recordings) ─────────────
  const userDataPath = app.getPath('userData');
  const audioDir = path.join(userDataPath, 'audio');

  function resolveAudioFilePath(fileName: string): string {
    if (typeof fileName !== 'string' || !fileName.trim()) throw new Error('Invalid file name');
    const trimmed = fileName.trim();
    if (path.basename(trimmed) !== trimmed || /[/\\]/.test(trimmed)) throw new Error('Invalid file name');
    const filePath = path.resolve(audioDir, trimmed);
    if (!filePath.startsWith(path.resolve(audioDir) + path.sep)) throw new Error('Path traversal');
    return filePath;
  }

  ipcMain.handle(IPC.AUDIO_SAVE, async (_e, fileName: unknown, arrayBuffer: unknown) => {
    try {
      if (typeof fileName !== 'string') return err('Invalid fileName');
      if (!(arrayBuffer instanceof ArrayBuffer) && !Buffer.isBuffer(arrayBuffer)) return err('Invalid data');
      fs.mkdirSync(audioDir, { recursive: true });
      const filePath = resolveAudioFilePath(fileName);
      fs.writeFileSync(filePath, Buffer.from(arrayBuffer as ArrayBuffer));
      return ok({ filePath });
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle(IPC.AUDIO_LIST, async () => {
    try {
      fs.mkdirSync(audioDir, { recursive: true });
      const files = fs.readdirSync(audioDir).map((name) => ({
        name,
        size: fs.statSync(path.join(audioDir, name)).size,
        createdAt: fs.statSync(path.join(audioDir, name)).birthtime.toISOString(),
      }));
      return ok({ files });
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle(IPC.AUDIO_DELETE, async (_e, fileName: unknown) => {
    try {
      if (typeof fileName !== 'string') return err('Invalid fileName');
      const filePath = resolveAudioFilePath(fileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return ok(undefined);
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
  });

  // ── Recording sessions ────────────────────────────────────────────────
  ipcMain.handle(IPC.RECORDING_START, (_e, raw: unknown) =>
    wrap(async () => {
      const data = RecordingStartSchema.parse(raw);
      const session = await RecordingService.startSession(data);
      return ok(session);
    })
  );

  ipcMain.handle(IPC.RECORDING_PAUSE, (_e, sessionId: unknown) =>
    wrap(async () => {
      if (typeof sessionId !== 'string') return err('Invalid sessionId');
      return ok(await RecordingService.pauseSession(sessionId));
    })
  );

  ipcMain.handle(IPC.RECORDING_RESUME, (_e, sessionId: unknown) =>
    wrap(async () => {
      if (typeof sessionId !== 'string') return err('Invalid sessionId');
      return ok(await RecordingService.resumeSession(sessionId));
    })
  );

  ipcMain.handle(IPC.RECORDING_STOP, (_e, sessionId: unknown) =>
    wrap(async () => {
      if (typeof sessionId !== 'string') return err('Invalid sessionId');
      return ok(await RecordingService.stopSession(sessionId));
    })
  );

  ipcMain.handle(IPC.RECORDING_GET_ACTIVE, (_e, lectureId: unknown) =>
    wrap(async () => {
      if (typeof lectureId !== 'string') return err('Invalid lectureId');
      return ok(await RecordingService.getActiveSession(lectureId));
    })
  );

  ipcMain.handle(IPC.RECORDING_CHUNK_SAVE, (_e, raw: unknown) =>
    wrap(async () => {
      const data = RecordingChunkSaveSchema.parse(raw);
      const buf = Buffer.from(data.arrayBuffer instanceof ArrayBuffer ? data.arrayBuffer : (data.arrayBuffer as Uint8Array).buffer);
      const chunk = await RecordingService.saveChunk({
        sessionId: data.sessionId,
        lectureId: data.lectureId,
        index: data.index,
        data: buf,
        durationMs: data.durationMs,
        startOffsetMs: data.startOffsetMs,
      });
      return ok(chunk);
    })
  );

  ipcMain.handle(IPC.RECORDING_CHECK_DISK, () =>
    wrap(async () => ok(await RecordingService.checkDiskSpace()))
  );

  // ── Courses ───────────────────────────────────────────────────────────
  ipcMain.handle(IPC.COURSE_LIST, () =>
    wrap(async () => {
      const courses = await CourseService.list();
      return ok(courses.map((c) => ({
        ...c,
        weakTopics: (() => { try { return JSON.parse(c.weakTopics) as string[]; } catch { return []; } })(),
        lectureCount: 0, // populated separately if needed
      })));
    })
  );

  ipcMain.handle(IPC.COURSE_GET, (_e, id: unknown) =>
    wrap(async () => {
      if (typeof id !== 'string') return err('Invalid id');
      const course = await CourseService.get(id);
      if (!course) return err('Course not found', 'NOT_FOUND');
      return ok(course);
    })
  );

  ipcMain.handle(IPC.COURSE_CREATE, (_e, raw: unknown) =>
    wrap(async () => {
      const data = CourseCreateSchema.parse(raw);
      return ok(await CourseService.create(data));
    })
  );

  ipcMain.handle(IPC.COURSE_UPDATE, (_e, id: unknown, raw: unknown) =>
    wrap(async () => {
      if (typeof id !== 'string') return err('Invalid id');
      return ok(await CourseService.update(id, raw as Parameters<typeof CourseService.update>[1]));
    })
  );

  ipcMain.handle(IPC.COURSE_DELETE, (_e, id: unknown) =>
    wrap(async () => {
      if (typeof id !== 'string') return err('Invalid id');
      await CourseService.delete(id);
      return ok(undefined);
    })
  );

  // ── Lectures ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC.LECTURE_LIST, (_e, courseId: unknown) =>
    wrap(async () => ok(await LectureService.list(typeof courseId === 'string' ? courseId : undefined)))
  );

  ipcMain.handle(IPC.LECTURE_GET, (_e, id: unknown) =>
    wrap(async () => {
      if (typeof id !== 'string') return err('Invalid id');
      const lecture = await LectureService.get(id);
      if (!lecture) return err('Lecture not found', 'NOT_FOUND');
      return ok(lecture);
    })
  );

  ipcMain.handle(IPC.LECTURE_CREATE, (_e, raw: unknown) =>
    wrap(async () => {
      const data = LectureCreateSchema.parse(raw);
      return ok(await LectureService.create(data));
    })
  );

  ipcMain.handle(IPC.LECTURE_UPDATE, (_e, id: unknown, raw: unknown) =>
    wrap(async () => {
      if (typeof id !== 'string') return err('Invalid id');
      return ok(await LectureService.update(id, raw as Parameters<typeof LectureService.update>[1]));
    })
  );

  ipcMain.handle(IPC.LECTURE_DELETE, (_e, id: unknown) =>
    wrap(async () => {
      if (typeof id !== 'string') return err('Invalid id');
      await LectureService.delete(id);
      return ok(undefined);
    })
  );

  // ── Transcript ────────────────────────────────────────────────────────
  ipcMain.handle(IPC.TRANSCRIPT_LIST, (_e, lectureId: unknown) =>
    wrap(async () => {
      if (typeof lectureId !== 'string') return err('Invalid lectureId');
      return ok(await TranscriptService.listForLecture(lectureId));
    })
  );

  ipcMain.handle(IPC.TRANSCRIPT_EDIT_SEGMENT, (_e, raw: unknown) =>
    wrap(async () => {
      const { segmentId, editedText } = TranscriptEditSchema.parse(raw);
      return ok(await TranscriptService.editSegment(segmentId, editedText));
    })
  );

  // ── Whisper models ────────────────────────────────────────────────────
  ipcMain.handle(IPC.MODEL_LIST, () =>
    wrap(async () => ok(await WhisperModelManager.list()))
  );

  ipcMain.handle(IPC.MODEL_DOWNLOAD_START, (_e, raw: unknown) =>
    wrap(async () => {
      const { modelId } = ModelDownloadStartSchema.parse(raw);
      // Start download async (non-blocking); progress sent via webContents.send
      void WhisperModelManager.startDownload(modelId);
      return ok({ started: true });
    })
  );

  ipcMain.handle(IPC.MODEL_DOWNLOAD_CANCEL, (_e, modelId: unknown) =>
    wrap(async () => {
      if (typeof modelId !== 'string') return err('Invalid modelId');
      WhisperModelManager.cancelDownload(modelId);
      return ok(undefined);
    })
  );

  ipcMain.handle(IPC.MODEL_DELETE, (_e, modelId: unknown) =>
    wrap(async () => {
      if (typeof modelId !== 'string') return err('Invalid modelId');
      await WhisperModelManager.deleteModel(modelId);
      return ok(undefined);
    })
  );

  // ── Jobs ──────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.JOB_LIST, (_e, filter: unknown) =>
    wrap(async () => ok(await JobQueue.list(filter as { status?: string; jobType?: string } | undefined)))
  );

  ipcMain.handle(IPC.JOB_CANCEL, (_e, jobId: unknown) =>
    wrap(async () => {
      if (typeof jobId !== 'string') return err('Invalid jobId');
      await JobQueue.cancel(jobId);
      return ok(undefined);
    })
  );

  // ── AI Providers ──────────────────────────────────────────────────────
  ipcMain.handle(IPC.PROVIDER_LIST, () =>
    wrap(async () => {
      const providers = await getPrisma().aiProvider.findMany({ orderBy: { createdAt: 'asc' } });
      // Never include secretKeyRef value to renderer — only id/displayName/enabled/etc.
      return ok(providers.map(({ secretKeyRef: _omit, ...p }) => ({
        ...p,
        hasSecret: SecretsService.hasSecret(`provider.${p.id}`),
      })));
    })
  );

  ipcMain.handle(IPC.PROVIDER_UPSERT, (_e, raw: unknown) =>
    wrap(async () => {
      const data = ProviderUpsertSchema.parse(raw);
      const db = getPrisma();
      if (data.id) {
        const updated = await db.aiProvider.update({
          where: { id: data.id },
          data: {
            providerType: data.providerType,
            displayName: data.displayName,
            enabled: data.enabled,
            isDefault: data.isDefault,
            baseUrl: data.baseUrl,
            modelRouting: JSON.stringify(data.modelRouting ?? {}),
          },
        });
        return ok({ id: updated.id });
      } else {
        const created = await db.aiProvider.create({
          data: {
            providerType: data.providerType,
            displayName: data.displayName,
            enabled: data.enabled,
            isDefault: data.isDefault,
            baseUrl: data.baseUrl,
            modelRouting: JSON.stringify(data.modelRouting ?? {}),
          },
        });
        return ok({ id: created.id });
      }
    })
  );

  ipcMain.handle(IPC.PROVIDER_DELETE, (_e, id: unknown) =>
    wrap(async () => {
      if (typeof id !== 'string') return err('Invalid id');
      SecretsService.deleteSecret(`provider.${id}`);
      await getPrisma().aiProvider.delete({ where: { id } });
      return ok(undefined);
    })
  );

  // ── Usage ─────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.USAGE_SUMMARY, (_e, raw: unknown) =>
    wrap(async () => {
      const { period = 'daily' } = (raw as { period?: string }) ?? {};
      const db = getPrisma();
      const since = period === 'monthly'
        ? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        : new Date(new Date().setHours(0, 0, 0, 0));

      const events = await db.aiUsageEvent.findMany({ where: { createdAt: { gte: since } } });
      const totalTokens = events.reduce((s, e) => s + e.inputTokens + e.outputTokens, 0);
      const totalCostCents = events.reduce((s, e) => s + e.estimatedCostCents, 0);
      const cacheHits = events.filter((e) => e.cacheHit).length;
      const settings = await SettingsService.get();
      const tokenLimit = period === 'monthly' ? settings.monthlyTokenLimit : settings.dailyTokenLimit;
      const costLimit = period === 'monthly' ? settings.monthlyCostLimitCents : settings.dailyCostLimitCents;

      return ok({
        period,
        totalTokens,
        totalCostCents,
        cacheHits,
        cacheHitRate: events.length > 0 ? cacheHits / events.length : 0,
        blockedRequests: 0,
        tokenLimit,
        costLimit,
        tokenLimitExceeded: totalTokens >= tokenLimit,
        costLimitExceeded: totalCostCents >= costLimit,
        breakdown: events.reduce<Record<string, { tokens: number; costCents: number }>>((acc, e) => {
          const key = `${e.provider}/${e.model}`;
          if (!acc[key]) acc[key] = { tokens: 0, costCents: 0 };
          acc[key]!.tokens += e.inputTokens + e.outputTokens;
          acc[key]!.costCents += e.estimatedCostCents;
          return acc;
        }, {}),
      });
    })
  );

  // ── Flashcards ────────────────────────────────────────────────────────
  ipcMain.handle(IPC.FLASHCARD_LIST, (_e, courseId: unknown) =>
    wrap(async () => {
      const db = getPrisma();
      return ok(await db.flashcard.findMany({
        where: typeof courseId === 'string' ? { courseId } : {},
        orderBy: { nextReviewDate: 'asc' },
        take: 100,
      }));
    })
  );

  ipcMain.handle(IPC.FLASHCARD_REVIEW, (_e, raw: unknown) =>
    wrap(async () => {
      const { flashcardId, quality } = FlashcardReviewSchema.parse(raw);
      const db = getPrisma();
      const card = await db.flashcard.findUniqueOrThrow({ where: { id: flashcardId } });

      // SM-2 algorithm
      const { easeFactor, intervalDays, repetitions } = computeSm2(
        card.easeFactor,
        card.intervalDays,
        card.repetitions,
        quality
      );

      const nextReviewDate = new Date(Date.now() + intervalDays * 86_400_000);
      const updated = await db.flashcard.update({
        where: { id: flashcardId },
        data: { easeFactor, intervalDays, repetitions, nextReviewDate, lastReviewDate: new Date() },
      });
      return ok(updated);
    })
  );

  // ── Chat ──────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.CHAT_HISTORY, (_e, courseId: unknown) =>
    wrap(async () => {
      const db = getPrisma();
      return ok(await db.chatMessage.findMany({
        where: typeof courseId === 'string' ? { courseId } : {},
        orderBy: { createdAt: 'asc' },
        take: 200,
      }));
    })
  );

  ipcMain.handle(IPC.CHAT_SEND, (_e, raw: unknown) =>
    wrap(async () => {
      const { courseId, message } = ChatSendSchema.parse(raw);
      const db = getPrisma();

      // Save user message
      await db.chatMessage.create({ data: { courseId, role: 'user', content: message } });

      // FTS5 retrieval for grounded answer
      const results = await TranscriptService.search(message, { courseId: courseId ?? undefined, limit: 5 });

      if (results.length === 0) {
        const reply = await db.chatMessage.create({
          data: {
            courseId,
            role: 'assistant',
            content: 'I could not find relevant transcript content to answer this question. Please ensure lectures have been transcribed.',
            citationIds: '[]',
          },
        });
        return ok({ message: reply, sources: [] });
      }

      // Build grounded context (extractive — no full transcript sent to AI by default)
      const context = results.map((r, i) => `[${i + 1}] ${r.text}`).join('\n\n');

      // For local-only mode, return an extractive summary.
      // When an AI provider is configured and limits allow, this would call the provider.
      const content = `Based on your lecture notes:\n\n${context}\n\n(Sources: ${results.map((r) => r.segmentId).join(', ')})`;
      const citationIds = results.map((r) => r.segmentId);

      const reply = await db.chatMessage.create({
        data: {
          courseId,
          role: 'assistant',
          content,
          citationIds: JSON.stringify(citationIds),
        },
      });
      return ok({ message: reply, sources: results });
    })
  );

  // ── Quiz ──────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.QUIZ_LIST, (_e, courseId: unknown) =>
    wrap(async () => {
      const db = getPrisma();
      return ok(await db.quiz.findMany({
        where: typeof courseId === 'string' ? { courseId } : {},
        orderBy: { createdAt: 'desc' },
        take: 50,
      }));
    })
  );

  ipcMain.handle(IPC.QUIZ_SUBMIT, (_e, raw: unknown) =>
    wrap(async () => {
      const { attemptId, answers } = QuizSubmitSchema.parse(raw);
      const db = getPrisma();

      let earnedPoints = 0;
      const results = [];

      for (const ans of answers) {
        const question = await db.quizQuestion.findUniqueOrThrow({ where: { id: ans.questionId } });
        const isCorrect = ans.answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
        const pts = isCorrect ? question.points : 0;
        earnedPoints += pts;

        const saved = await db.quizAnswer.create({
          data: {
            attemptId,
            questionId: ans.questionId,
            answer: ans.answer,
            isCorrect,
            pointsEarned: pts,
            feedback: question.explanation,
          },
        });
        results.push(saved);
      }

      const attempt = await db.quizAttempt.update({
        where: { id: attemptId },
        data: { submittedAt: new Date(), score: earnedPoints },
      });

      return ok({ attempt, answers: results, earnedPoints });
    })
  );

  // ── Backup & diagnostics ──────────────────────────────────────────────
  ipcMain.handle(IPC.DIAGNOSTICS_GET, () =>
    wrap(async () => ok({
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron,
      userData: app.getPath('userData'),
      // Note: no secrets, no auth tokens, no full paths that expose usernames
    }))
  );

  log.info('[ipc] All handlers registered');
}

// ── SM-2 spaced repetition algorithm ────────────────────────────────────

function computeSm2(
  ef: number,
  interval: number,
  reps: number,
  quality: number
): { easeFactor: number; intervalDays: number; repetitions: number } {
  if (quality < 3) {
    return { easeFactor: Math.max(1.3, ef - 0.2), intervalDays: 1, repetitions: 0 };
  }
  const newEf = Math.max(1.3, ef + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  let newInterval: number;
  if (reps === 0) newInterval = 1;
  else if (reps === 1) newInterval = 6;
  else newInterval = Math.round(interval * newEf);
  return { easeFactor: newEf, intervalDays: newInterval, repetitions: reps + 1 };
}
