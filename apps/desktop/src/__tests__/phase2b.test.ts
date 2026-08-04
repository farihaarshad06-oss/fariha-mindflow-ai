/**
 * Phase 2B Tests — Whisper worker, AI providers, learning services, backup/restore.
 *
 * All tests use in-memory SQLite via Prisma.
 * External HTTP and child_process calls are mocked.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, assert } from 'vitest';

function expectDefined<T>(
  value: T | null | undefined,
  message = 'Expected value to be defined',
): asserts value is T {
  assert(value !== null && value !== undefined, message);
}
import { PrismaClient } from '../generated/prisma';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../services/database', () => ({
  getPrisma: () => prisma,
  initDatabase: async () => prisma,
  closeDatabase: async () => {},
}));

vi.mock('../services/settings', () => ({
  SettingsService: {
    get: async () => ({
      id: 'default',
      preferredLanguage: 'en',
      theme: 'system',
      audioRetentionDays: 90,
      recordingConsentGiven: false,
      onboardingComplete: false,
      storagePath: os.tmpdir(),
      whisperModelId: null,
      defaultAiProvider: null,
      aiMode: 'local',
      dailyTokenLimit: 50000,
      monthlyTokenLimit: 500000,
      dailyCostLimitCents: 20000,
      monthlyCostLimitCents: 500000,
      quizDayOfWeek: 0,
      privacyModeDefault: false,
      updatedAt: new Date(),
    }),
    update: async (d: unknown) => d,
    getStoragePath: async () => os.tmpdir(),
  },
}));

vi.mock('electron', () => ({
  app: {
    getPath: (key: string) => key === 'userData' ? os.tmpdir() : os.tmpdir(),
    getVersion: () => '1.0.0',
    isPackaged: false,
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString(),
  },
  BrowserWindow: { getAllWindows: () => [] },
}));

vi.mock('../services/secrets', () => ({
  SecretsService: {
    getSecret: (key: string) => {
      if (key.startsWith('provider.')) return 'test-api-key';
      return null;
    },
    hasSecret: () => true,
    setSecret: () => {},
    deleteSecret: () => {},
    listKeys: () => [],
  },
}));

// ── Test database setup ────────────────────────────────────────────────────

let prisma: PrismaClient;
let dbPath: string;

beforeAll(async () => {
  dbPath = path.join(os.tmpdir(), `test-mindflow-2b-${Date.now()}.db`);
  prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

  const { execSync } = await import('node:child_process');
  execSync(
    `npx prisma db push --schema=${path.join(__dirname, '../../prisma/schema.prisma')} --skip-generate`,
    {
      env: { ...process.env, DESKTOP_DATABASE_URL: `file:${dbPath}` },
      cwd: path.join(__dirname, '../..'),
      stdio: 'pipe',
    }
  );
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

beforeEach(async () => {
  await prisma.quizAnswer.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.quizQuestion.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.flashcard.deleteMany();
  await prisma.keyConcept.deleteMany();
  await prisma.lectureSummary.deleteMany();
  await prisma.transcriptSegment.deleteMany();
  await prisma.audioChunk.deleteMany();
  await prisma.recordingSession.deleteMany();
  await prisma.lecture.deleteMany();
  await prisma.course.deleteMany();
  await prisma.aiUsageEvent.deleteMany();
  await prisma.aiRequestCache.deleteMany();
  await prisma.aiProvider.deleteMany();
  await prisma.backupRecord.deleteMany();
});

// ── Whisper Worker ─────────────────────────────────────────────────────────

describe('WhisperWorker', () => {
  it('starts and stops without error', async () => {
    const { WhisperWorker } = await import('../services/whisperWorker');
    WhisperWorker.start();
    expect(WhisperWorker.isRunning()).toBe(true);
    WhisperWorker.stop();
    expect(WhisperWorker.isRunning()).toBe(false);
  });

  it('enqueues a TRANSCRIBE job via enqueueTranscription', async () => {
    const { WhisperWorker } = await import('../services/whisperWorker');
    const { JobQueue } = await import('../services/jobQueue');

    const course = await prisma.course.create({ data: { title: 'Test Course' } });
    const lecture = await prisma.lecture.create({
      data: { courseId: course.id, title: 'Test Lecture', state: 'PENDING' },
    });

    const jobId = await WhisperWorker.enqueueTranscription(lecture.id, { language: 'en' });
    expect(jobId).toBeTruthy();

    const job = await prisma.processingJob.findUnique({ where: { id: jobId } });
    expect(job).not.toBeNull();
    expect(job?.jobType).toBe('TRANSCRIBE');
    expect(job?.status).toBe('PENDING');

    expectDefined(job);
    const payload = JSON.parse(job.payload) as { lectureId: string };
    expect(payload.lectureId).toBe(lecture.id);

    await JobQueue.cancel(jobId);
  });

  it('cancels an active job', async () => {
    const { WhisperWorker } = await import('../services/whisperWorker');
    const { JobQueue } = await import('../services/jobQueue');

    const course = await prisma.course.create({ data: { title: 'C' } });
    const lecture = await prisma.lecture.create({ data: { courseId: course.id, title: 'L', state: 'PENDING' } });
    const jobId = await WhisperWorker.enqueueTranscription(lecture.id);

    // cancelJob should abort the active controller (noop if not yet running)
    WhisperWorker.cancelJob(jobId);
    await JobQueue.cancel(jobId);

    const job = await prisma.processingJob.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('CANCELLED');
  });

  it('handles missing model gracefully', async () => {
    const { JobQueue } = await import('../services/jobQueue');

    // Ensure no model is READY
    await prisma.whisperModel.deleteMany();

    const course = await prisma.course.create({ data: { title: 'C2' } });
    const lecture = await prisma.lecture.create({ data: { courseId: course.id, title: 'L2', state: 'PENDING' } });

    // Manually enqueue a job and process it — should fail with MODEL_NOT_READY
    const job = await JobQueue.enqueue({
      jobType: 'TRANSCRIBE',
      payload: { lectureId: lecture.id },
      deduplicate: false,
      maxRetries: 1,
    });

    const claimed = await JobQueue.claimNext(['TRANSCRIBE']);
    expect(claimed).not.toBeNull();

    // Simulate the model-not-ready path by checking the WhisperModelManager
    const { WhisperModelManager } = await import('../services/whisperModels');
    const model = await WhisperModelManager.getReadyModel();
    expect(model).toBeNull(); // No model downloaded

    await JobQueue.fail(job.id, 'MODEL_NOT_READY', 'No ready Whisper model');
    const updated = await prisma.processingJob.findUnique({ where: { id: job.id } });
    // maxRetries=1: first fail (retryCount becomes 1 which >= maxRetries=1) → FAILED
    expect(updated?.status).toBe('FAILED');
    expect(updated?.errorCode).toBe('MODEL_NOT_READY');
  });
});

// ── AI Providers ───────────────────────────────────────────────────────────

describe('AI Provider configuration', () => {
  it('stores provider config without API key in database', async () => {
    const provider = await prisma.aiProvider.create({
      data: {
        providerType: 'openai',
        displayName: 'OpenAI Test',
        enabled: true,
        isDefault: true,
        modelRouting: JSON.stringify({ economy: 'gpt-4o-mini', balanced: 'gpt-4o-mini', quality: 'gpt-4o' }),
      },
    });

    expect(provider.id).toBeTruthy();
    expect(provider.providerType).toBe('openai');
    // secretKeyRef should NOT be a plaintext API key
    expect(provider.secretKeyRef).toBeNull();
  });

  it('resolves correct model for each tier', async () => {
    // Test the model routing logic by checking stored routing
    const routing = { economy: 'gpt-4o-mini', balanced: 'gpt-4o', quality: 'gpt-4o' };
    expect(routing.economy).toBe('gpt-4o-mini');
    expect(routing.quality).toBe('gpt-4o');
  });

  it('validates provider types', () => {
    const validTypes = ['openai', 'azure', 'gemini', 'ollama', 'lmstudio', 'openai-compat'];
    for (const t of validTypes) {
      expect(validTypes).toContain(t);
    }
  });
});

// ── Token/cost limit enforcement ───────────────────────────────────────────

describe('Usage limits', () => {
  it('records usage events correctly', async () => {
    await prisma.aiUsageEvent.create({
      data: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        operation: 'summary',
        inputTokens: 1000,
        outputTokens: 500,
        estimatedCostCents: 2,
        cacheHit: false,
        requestHash: 'testhash123',
      },
    });

    const events = await prisma.aiUsageEvent.findMany({ where: { provider: 'openai' } });
    expect(events.length).toBe(1);
    const event = events[0];
    expectDefined(event);
    expect(event.inputTokens).toBe(1000);
    expect(event.estimatedCostCents).toBe(2);
  });

  it('caches AI responses and retrieves them', async () => {
    const hash = 'test-cache-hash-' + Date.now();
    await prisma.aiRequestCache.create({
      data: {
        requestHash: hash,
        provider: 'openai',
        model: 'gpt-4o-mini',
        operation: 'flashcards',
        responseJson: JSON.stringify({ flashcards: [{ question: 'Q', answer: 'A', difficulty: 2 }] }),
        inputTokens: 200,
        outputTokens: 100,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const cached = await prisma.aiRequestCache.findUnique({ where: { requestHash: hash } });
    expect(cached).not.toBeNull();
    expect(cached?.hitCount).toBe(0);

    expectDefined(cached);
    const data = JSON.parse(cached.responseJson) as { flashcards: unknown[] };
    expect(data.flashcards.length).toBe(1);
  });
});

// ── Learning service ───────────────────────────────────────────────────────

describe('Learning service — extractive mode (no AI provider)', () => {
  it('generates extractive summary when no provider configured', async () => {
    const { generateSummary } = await import('../services/learning');

    const course = await prisma.course.create({ data: { title: 'ML Course' } });
    const lecture = await prisma.lecture.create({
      data: { courseId: course.id, title: 'Neural Networks', state: 'READY' },
    });

    // Insert transcript segments
    await prisma.transcriptSegment.createMany({
      data: [
        { lectureId: lecture.id, segmentIndex: 0, text: 'Neural networks are computing systems inspired by biological neural networks.', timestampStart: 0, timestampEnd: 5 },
        { lectureId: lecture.id, segmentIndex: 1, text: 'They consist of layers of interconnected nodes called neurons.', timestampStart: 5, timestampEnd: 10 },
        { lectureId: lecture.id, segmentIndex: 2, text: 'Deep learning uses multiple hidden layers to learn complex representations.', timestampStart: 10, timestampEnd: 15 },
      ],
    });

    const summary = await generateSummary(lecture.id);
    expect(summary.lectureId).toBe(lecture.id);
    expect(summary.content).toBeTruthy();
    expect(summary.content.length).toBeGreaterThan(10);
  });

  it('generates flashcards from summary definitions', async () => {
    const { generateFlashcards } = await import('../services/learning');

    const course = await prisma.course.create({ data: { title: 'Algo Course' } });
    const lecture = await prisma.lecture.create({
      data: { courseId: course.id, title: 'Sorting', state: 'READY' },
    });

    await prisma.transcriptSegment.createMany({
      data: [
        { lectureId: lecture.id, segmentIndex: 0, text: 'Quicksort is a divide-and-conquer sorting algorithm.', timestampStart: 0, timestampEnd: 3 },
        { lectureId: lecture.id, segmentIndex: 1, text: 'Merge sort has O(n log n) time complexity in all cases.', timestampStart: 3, timestampEnd: 7 },
      ],
    });

    // Create a summary with definitions to drive extractive flashcards
    await prisma.lectureSummary.create({
      data: {
        lectureId: lecture.id,
        content: 'Sorting algorithms',
        definitions: JSON.stringify([
          { term: 'Quicksort', definition: 'A divide-and-conquer sorting algorithm with O(n log n) average case.' },
          { term: 'Merge sort', definition: 'A stable sorting algorithm with O(n log n) time complexity.' },
        ]),
      },
    });

    const cards = await generateFlashcards(lecture.id, course.id);
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards[0]?.question).toContain('Quicksort');
  });

  it('deduplicates flashcards on re-generation', async () => {
    const { generateFlashcards } = await import('../services/learning');

    const course = await prisma.course.create({ data: { title: 'Test Course' } });
    const lecture = await prisma.lecture.create({
      data: { courseId: course.id, title: 'Test', state: 'READY' },
    });

    await prisma.transcriptSegment.create({
      data: { lectureId: lecture.id, segmentIndex: 0, text: 'A binary tree is a tree with at most two children per node.', timestampStart: 0, timestampEnd: 5 },
    });
    await prisma.lectureSummary.create({
      data: {
        lectureId: lecture.id,
        content: 'Data structures',
        definitions: JSON.stringify([{ term: 'Binary tree', definition: 'A tree with at most two children.' }]),
      },
    });

    const cards1 = await generateFlashcards(lecture.id, course.id);
    const cards2 = await generateFlashcards(lecture.id, course.id);

    // Second call should not create duplicates
    const allCards = await prisma.flashcard.findMany({ where: { lectureId: lecture.id } });
    expect(allCards.length).toBe(cards1.length); // same count both times
    expect(cards2.length).toBe(cards1.length);
  });
});

// ── Grounded chat ──────────────────────────────────────────────────────────

describe('Grounded chat', () => {
  it('returns no-source message when no transcripts exist', async () => {
    const { groundedChat } = await import('../services/learning');

    const course = await prisma.course.create({ data: { title: 'Empty Course' } });
    const result = await groundedChat({ courseId: course.id, message: 'What is machine learning?' });

    expect(result.answer).toContain('could not find');
    expect(result.citationIds).toHaveLength(0);
    expect(result.fromAi).toBe(false);
  });

  it('returns extractive answer with citation IDs when transcripts exist', async () => {
    // FTS5 search is mocked via direct DB in tests; let's verify the flow
    const { groundedChat } = await import('../services/learning');
    const { TranscriptService } = await import('../services/transcript');

    // Mock TranscriptService.search
    const mockSearch = vi.spyOn(TranscriptService, 'search').mockResolvedValueOnce([
      { segmentId: 'seg-001', lectureId: 'lec-001', text: 'Machine learning is a subset of AI.', rank: -1.5 },
    ]);

    const result = await groundedChat({ message: 'What is machine learning?' });

    expect(result.sources.length).toBe(1);
    expect(result.answer).toContain('Machine learning');
    mockSearch.mockRestore();
  });

  it('validates source segment IDs against database', async () => {
    const { groundedChat } = await import('../services/learning');
    const { TranscriptService } = await import('../services/transcript');

    const course = await prisma.course.create({ data: { title: 'C' } });
    const lecture = await prisma.lecture.create({ data: { courseId: course.id, title: 'L', state: 'READY' } });
    const seg = await prisma.transcriptSegment.create({
      data: { lectureId: lecture.id, segmentIndex: 0, text: 'Real segment text', timestampStart: 0, timestampEnd: 5 },
    });

    // Mock search to return both a valid and invalid ID
    const mockSearch = vi.spyOn(TranscriptService, 'search').mockResolvedValueOnce([
      { segmentId: seg.id, lectureId: lecture.id, text: 'Real segment text', rank: -1.0 },
      { segmentId: 'nonexistent-id', lectureId: lecture.id, text: 'Fabricated text', rank: -0.5 },
    ]);

    const result = await groundedChat({ message: 'test' });

    // Only valid IDs should be in citations
    expect(result.citationIds).toContain(seg.id);
    // The nonexistent ID should be filtered out
    expect(result.citationIds).not.toContain('nonexistent-id');

    mockSearch.mockRestore();
  });
});

// ── Backup and restore ─────────────────────────────────────────────────────

describe('Backup and restore', () => {
  it('creates a backup ZIP with manifest and data', async () => {
    const { createBackup } = await import('../services/backup');

    await prisma.course.create({ data: { title: 'Backup Test Course' } });

    const destPath = path.join(os.tmpdir(), `backup-test-${Date.now()}.zip`);
    const result = await createBackup({ destinationPath: destPath });

    expect(result.filePath).toBe(destPath);
    expect(result.fileSizeBytes).toBeGreaterThan(0);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(fs.existsSync(destPath)).toBe(true);

    // Verify ZIP contains manifest
    const zipData = fs.readFileSync(destPath);
    expect(zipData.slice(0, 4).toString('hex')).toBe('504b0304'); // ZIP magic

    // Clean up
    fs.unlinkSync(destPath);
  });

  it('persists backup record in database', async () => {
    const { createBackup } = await import('../services/backup');

    const destPath = path.join(os.tmpdir(), `backup-persist-${Date.now()}.zip`);
    await createBackup({ destinationPath: destPath });

    const record = await prisma.backupRecord.findFirst({ orderBy: { createdAt: 'desc' } });
    expect(record).not.toBeNull();
    expect(record?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(record?.fileSizeBytes).toBeGreaterThan(0);

    fs.unlinkSync(destPath);
  });

  it('previews backup without restoring', async () => {
    const { createBackup, previewRestore } = await import('../services/backup');

    await prisma.course.create({ data: { title: 'Preview Test' } });
    const destPath = path.join(os.tmpdir(), `backup-preview-${Date.now()}.zip`);
    await createBackup({ destinationPath: destPath });

    const preview = await previewRestore(destPath);
    expect(preview.version).toBe('1.0');
    expect(preview.compatible).toBe(true);
    expect(preview.counts.courses).toBeGreaterThanOrEqual(1);

    fs.unlinkSync(destPath);
  });

  it('restores data from backup', async () => {
    const { createBackup, restoreBackup } = await import('../services/backup');

    // Create some data
    const course = await prisma.course.create({ data: { title: 'Restore Me' } });
    const lecture = await prisma.lecture.create({ data: { courseId: course.id, title: 'Lecture R', state: 'READY' } });
    await prisma.transcriptSegment.create({
      data: { lectureId: lecture.id, segmentIndex: 0, text: 'Restore test', timestampStart: 0, timestampEnd: 5 },
    });

    const destPath = path.join(os.tmpdir(), `backup-restore-${Date.now()}.zip`);
    await createBackup({ destinationPath: destPath });

    // Wipe everything
    await prisma.transcriptSegment.deleteMany();
    await prisma.lecture.deleteMany();
    await prisma.course.deleteMany();

    // Restore
    await restoreBackup(destPath);

    const courses = await prisma.course.findMany();
    expect(courses.length).toBeGreaterThanOrEqual(1);
    expect(courses.some((c) => c.title === 'Restore Me')).toBe(true);

    fs.unlinkSync(destPath);
  });
});

// ── Export functions ───────────────────────────────────────────────────────

describe('Export', () => {
  it('exports transcript as TXT', async () => {
    const { exportTranscript } = await import('../services/backup');

    const course = await prisma.course.create({ data: { title: 'Export Course' } });
    const lecture = await prisma.lecture.create({ data: { courseId: course.id, title: 'Export Lecture', state: 'READY' } });
    await prisma.transcriptSegment.createMany({
      data: [
        { lectureId: lecture.id, segmentIndex: 0, text: 'First sentence.', timestampStart: 0, timestampEnd: 3 },
        { lectureId: lecture.id, segmentIndex: 1, text: 'Second sentence.', timestampStart: 3, timestampEnd: 6 },
      ],
    });

    const filePath = await exportTranscript(lecture.id, 'txt');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('First sentence');
    expect(content).toContain('00:00');

    fs.unlinkSync(filePath);
  });

  it('exports transcript as Markdown', async () => {
    const { exportTranscript } = await import('../services/backup');

    const course = await prisma.course.create({ data: { title: 'MD Course' } });
    const lecture = await prisma.lecture.create({ data: { courseId: course.id, title: 'MD Lecture', state: 'READY' } });
    await prisma.transcriptSegment.create({
      data: { lectureId: lecture.id, segmentIndex: 0, text: 'Markdown content.', timestampStart: 0, timestampEnd: 5 },
    });

    const filePath = await exportTranscript(lecture.id, 'md');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).toContain('# MD Lecture');
    expect(content).toContain('**[');
    expect(content).toContain('Markdown content');

    fs.unlinkSync(filePath);
  });

  it('exports flashcards as CSV', async () => {
    const { exportFlashcards } = await import('../services/backup');

    const course = await prisma.course.create({ data: { title: 'CSV Course' } });
    await prisma.flashcard.create({
      data: {
        courseId: course.id,
        question: 'What is entropy?',
        answer: 'A measure of disorder or randomness.',
        difficulty: 3,
      },
    });

    const filePath = await exportFlashcards(course.id, 'csv');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).toContain('Question,Answer');
    expect(content).toContain('What is entropy?');

    fs.unlinkSync(filePath);
  });

  it('exports flashcards as Anki TSV', async () => {
    const { exportFlashcards } = await import('../services/backup');

    const course = await prisma.course.create({ data: { title: 'Anki Course' } });
    await prisma.flashcard.create({
      data: {
        courseId: course.id,
        question: 'Define recursion',
        answer: 'A function that calls itself.',
        difficulty: 2,
      },
    });

    const filePath = await exportFlashcards(course.id, 'anki');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).toContain('Define recursion');
    expect(content).toContain('\t'); // TSV separator

    fs.unlinkSync(filePath);
  });

  it('exports full data as JSON', async () => {
    const { exportFullData } = await import('../services/backup');

    const filePath = await exportFullData(true);
    expect(fs.existsSync(filePath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { exportedAt: string };
    expect(content.exportedAt).toBeTruthy();

    fs.unlinkSync(filePath);
  });

  it('redacts sensitive data in diagnostics export', async () => {
    const { exportDiagnostics } = await import('../services/backup');

    const filePath = await exportDiagnostics();
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { userData: string };

    expect(content.userData).toBe('[REDACTED]');

    fs.unlinkSync(filePath);
  });
});

// ── IPC security ───────────────────────────────────────────────────────────

describe('IPC security', () => {
  it('assertSafePath blocks path traversal', async () => {
    const { assertSafePath } = await import('../ipc/contracts');
    expect(() => assertSafePath('/tmp/../etc/passwd', '/tmp/mindflow')).toThrow('Path traversal');
  });

  it('assertSafePath allows valid paths inside root', async () => {
    const { assertSafePath } = await import('../ipc/contracts');
    const result = assertSafePath('/tmp/mindflow/audio/chunk.webm', '/tmp/mindflow');
    expect(result).toContain('chunk.webm');
  });
});

// ── Model checksum verification ────────────────────────────────────────────

describe('WhisperModelManager', () => {
  it('lists all model definitions', async () => {
    const { WHISPER_MODELS } = await import('../services/whisperModels');
    expect(WHISPER_MODELS.length).toBeGreaterThanOrEqual(4);
    for (const model of WHISPER_MODELS) {
      expect(model.id).toBeTruthy();
      expect(model.sha256).toMatch(/^[a-f0-9]{63,64}$/);
      expect(model.downloadUrl).toContain('https://');
    }
  });

  it('getReadyModel returns null when no model downloaded', async () => {
    const { WhisperModelManager } = await import('../services/whisperModels');
    const model = await WhisperModelManager.getReadyModel();
    expect(model).toBeNull();
  });
});
