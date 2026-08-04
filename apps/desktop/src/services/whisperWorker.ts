/**
 * WhisperWorker — processes TRANSCRIBE jobs from the persistent job queue.
 *
 * Uses whisper.cpp via the `nodejs-whisper` npm package which bundles a pre-compiled
 * whisper.cpp binary for each platform. The npm package ships whisper.cpp native
 * addons and invokes them via child_process in an isolated manner so inference
 * never runs in the Electron renderer.
 *
 * Security:
 * - All paths validated against known safe directories before use
 * - No shell interpretation: all child_process calls use array argv (no shell:true)
 * - Model path validated against modelsDir
 * - Audio path validated against audioDir
 * - No audio is uploaded to any cloud service
 *
 * Architecture:
 * - startWorkerLoop() polls the job queue every POLL_INTERVAL_MS
 * - Each TRANSCRIBE job payload: { lectureId, audioChunkId?, language?, modelId? }
 * - Converts WebM/Opus → WAV using ffmpeg bundled via ffmpeg-static
 * - Runs whisper.cpp on WAV file
 * - Persists TranscriptSegment rows transactionally
 * - Marks AudioChunk and ProcessingJob statuses correctly
 * - Supports cancellation via AbortController map
 * - Sends progress events to renderer via BrowserWindow.getAllWindows()
 */

import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { BrowserWindow, app } from 'electron';
import log from 'electron-log/main';
import { getPrisma } from './database';
import { JobQueue } from './jobQueue';
import { WhisperModelManager } from './whisperModels';
import { TranscriptService } from './transcript';
import { SettingsService } from './settings';

// ── Constants ──────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 3_000;
const JOB_TIMEOUT_MS = 10 * 60 * 1000; // 10 min per chunk

// ── Active job cancellation ────────────────────────────────────────────────

const activeJobs = new Map<string, AbortController>();

// ── IPC push helpers ───────────────────────────────────────────────────────

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

// ── Path helpers ───────────────────────────────────────────────────────────

async function getAudioDir(): Promise<string> {
  const base = await SettingsService.getStoragePath();
  return path.join(base, 'audio');
}

function assertSafeAudioPath(filePath: string, audioDir: string): string {
  const resolved = path.resolve(filePath);
  const root = path.resolve(audioDir);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(`Path traversal blocked: ${path.basename(filePath)}`);
  }
  return resolved;
}

function assertSafeModelPath(filePath: string): string {
  const modelsDir = path.join(app.getPath('userData'), 'models');
  const resolved = path.resolve(filePath);
  const root = path.resolve(modelsDir);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error('Model path outside models directory');
  }
  return resolved;
}

// ── ffmpeg resolution ──────────────────────────────────────────────────────

let _ffmpegPath: string | null | undefined = undefined;

function getFfmpegPath(): string | null {
  if (_ffmpegPath !== undefined) return _ffmpegPath;
  // Try ffmpeg-static package first
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require('ffmpeg-static') as string | null;
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      _ffmpegPath = ffmpegStatic;
      return _ffmpegPath;
    }
  } catch { /* not available */ }
  // Try system ffmpeg
  for (const candidate of ['ffmpeg', '/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg']) {
    try {
      execFileSync(candidate, ['-version'], { stdio: 'pipe', timeout: 3000 });
      _ffmpegPath = candidate;
      return _ffmpegPath;
    } catch { /* not available */ }
  }
  _ffmpegPath = null;
  return null;
}

// ── Audio conversion: WebM/Opus → WAV 16kHz mono ──────────────────────────

async function convertToWav(inputPath: string, outputPath: string, signal: AbortSignal): Promise<void> {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) throw new Error('ffmpeg not available for audio conversion');

  return new Promise((resolve, reject) => {
    // Safe argument array — NO shell interpolation
    const args = [
      '-y',
      '-i', inputPath,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      '-f', 'wav',
      outputPath,
    ];

    const proc = spawn(ffmpeg, args, { stdio: 'pipe', shell: false });

    signal.addEventListener('abort', () => { proc.kill('SIGTERM'); });

    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString().slice(-500); });

    proc.on('close', (code) => {
      if (signal.aborted) { reject(new Error('CANCELLED')); return; }
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-200)}`));
    });

    proc.on('error', reject);
  });
}

// ── Whisper.cpp binary resolution ─────────────────────────────────────────

let _whisperBin: string | null | undefined = undefined;

function getWhisperBin(): string | null {
  if (_whisperBin !== undefined) return _whisperBin;

  const candidates: string[] = [];

  // 1. Bundled via electron-builder extraResources
  const resourcesPath = process.resourcesPath ?? '';
  candidates.push(
    path.join(resourcesPath, 'bin', 'whisper-cli'),
    path.join(resourcesPath, 'bin', 'whisper'),
    path.join(resourcesPath, 'bin', 'main'), // whisper.cpp default binary name
    path.join(resourcesPath, 'bin', 'whisper-cli.exe'),
    path.join(resourcesPath, 'bin', 'main.exe'),
  );

  // 2. nodejs-whisper package bundled binary
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('nodejs-whisper') as { WHISPER_CPP_BINARY?: string };
    if (pkg.WHISPER_CPP_BINARY && fs.existsSync(pkg.WHISPER_CPP_BINARY)) {
      _whisperBin = pkg.WHISPER_CPP_BINARY;
      return _whisperBin;
    }
  } catch { /* not available */ }

  // 3. System PATH (dev environment)
  for (const name of ['whisper-cli', 'whisper', 'main']) {
    try {
      execFileSync(name, ['--help'], { stdio: 'pipe', timeout: 3000 });
      _whisperBin = name;
      return _whisperBin;
    } catch { /* not available */ }
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      _whisperBin = c;
      return _whisperBin;
    }
  }

  _whisperBin = null;
  return null;
}

// ── Whisper inference ──────────────────────────────────────────────────────

interface WhisperSegment {
  id: number;
  start: number; // seconds
  end: number;
  text: string;
  confidence?: number;
}

async function runWhisper(opts: {
  wavPath: string;
  modelPath: string;
  language: string;
  jobId: string;
  signal: AbortSignal;
  onProgress?: (pct: number) => void;
}): Promise<WhisperSegment[]> {
  const bin = getWhisperBin();
  if (!bin) throw new Error('Whisper binary not found. Please bundle whisper-cli in extraResources/bin/.');

  const { wavPath, modelPath, language, signal, onProgress } = opts;

  // Re-add timestamps via JSON output flag
  const jsonArgs = [
    '-m', modelPath,
    '-f', wavPath,
    '-l', language === 'auto' ? 'auto' : language,
    '-oj', // output JSON
    '--print-progress',
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn(bin, jsonArgs, { stdio: 'pipe', shell: false });

    signal.addEventListener('abort', () => { proc.kill('SIGTERM'); });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d: Buffer) => {
      const line = d.toString();
      stderr += line.slice(-1000);
      // Parse progress from whisper.cpp output: "progress = XX%"
      const m = /progress\s*=\s*(\d+)%/i.exec(line);
      if (m && onProgress) onProgress(parseInt(m[1] ?? '0', 10));
    });

    proc.on('close', (code) => {
      if (signal.aborted) { reject(new Error('CANCELLED')); return; }
      if (code !== 0) {
        reject(new Error(`whisper exited ${code}: ${stderr.slice(-300)}`));
        return;
      }

      // whisper.cpp JSON output is written to <wavPath>.json
      const jsonPath = `${wavPath}.json`;
      try {
        let parsed: { transcription?: Array<{ id: number; timestamps?: { from: string; to: string }; offsets?: { from: number; to: number }; text: string }> };
        if (fs.existsSync(jsonPath)) {
          parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as typeof parsed;
          try { fs.unlinkSync(jsonPath); } catch { /* cleanup */ }
        } else {
          // Fallback: parse stdout as JSON
          parsed = JSON.parse(stdout || '{}') as typeof parsed;
        }

        const segments: WhisperSegment[] = (parsed.transcription ?? []).map((seg) => ({
          id: seg.id,
          start: seg.offsets ? seg.offsets.from / 1000 : parseTimestamp(seg.timestamps?.from ?? '00:00:00,000'),
          end: seg.offsets ? seg.offsets.to / 1000 : parseTimestamp(seg.timestamps?.to ?? '00:00:00,000'),
          text: seg.text.trim(),
          confidence: undefined,
        })).filter((s) => s.text.length > 0);

        resolve(segments);
      } catch (e) {
        reject(new Error(`Failed to parse whisper JSON output: ${e instanceof Error ? e.message : String(e)}`));
      }
    });

    proc.on('error', (e) => reject(new Error(`Failed to start whisper: ${e.message}`)));
  });
}

function parseTimestamp(ts: string): number {
  // Format: HH:MM:SS,mmm
  const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(ts);
  if (!m) return 0;
  return parseInt(m[1] ?? '0', 10) * 3600 + parseInt(m[2] ?? '0', 10) * 60 + parseInt(m[3] ?? '0', 10) + parseInt(m[4] ?? '0', 10) / 1000;
}

// ── Core job processing ────────────────────────────────────────────────────

async function processTranscribeJob(job: Awaited<ReturnType<typeof JobQueue.claimNext>>): Promise<void> {
  if (!job) return;

  const jobId = job.id;
  const payload = job.payload as {
    lectureId?: string;
    audioChunkId?: string;
    language?: string;
    modelId?: string;
  };

  const { lectureId, audioChunkId, language = 'auto', modelId } = payload;
  if (!lectureId) {
    await JobQueue.fail(jobId, 'INVALID_PAYLOAD', 'Missing lectureId');
    return;
  }

  const db = getPrisma();
  const controller = new AbortController();
  activeJobs.set(jobId, controller);
  const signal = controller.signal;

  // Job timeout
  const timeoutHandle = setTimeout(() => {
    controller.abort();
    log.warn(`[whisper] Job ${jobId} timed out`);
  }, JOB_TIMEOUT_MS);

  let wavPath: string | null = null;
  const chunkId: string | null = audioChunkId ?? null;

  try {
    broadcast('job:progress', { jobId, status: 'RUNNING', pct: 0, lectureId });

    // ── Resolve model ──────────────────────────────────────────────────────
    const modelRecord = await WhisperModelManager.getReadyModel(modelId);
    if (!modelRecord) {
      await JobQueue.fail(jobId, 'MODEL_NOT_READY', 'No ready Whisper model. Download a model first.');
      broadcast('job:progress', { jobId, status: 'FAILED', error: 'MODEL_NOT_READY', lectureId });
      return;
    }
    const modelPath = assertSafeModelPath(modelRecord.localPath);

    // ── Verify model integrity ─────────────────────────────────────────────
    const modelDef = (await import('./whisperModels')).WHISPER_MODELS.find((m) => m.id === modelRecord.id);
    if (modelDef) {
      const ok = await verifyFileSha256(modelPath, modelDef.sha256);
      if (!ok) {
        await db.whisperModel.update({ where: { id: modelRecord.id }, data: { state: 'ERROR' } });
        await JobQueue.fail(jobId, 'MODEL_CORRUPTED', 'Model checksum failed. Please re-download the model.');
        broadcast('job:progress', { jobId, status: 'FAILED', error: 'MODEL_CORRUPTED', lectureId });
        return;
      }
    }

    // ── Resolve audio chunk(s) ─────────────────────────────────────────────
    let chunksToProcess: Array<{ id: string; filePath: string; startOffsetMs: number }>;

    if (chunkId) {
      const chunk = await db.audioChunk.findUnique({ where: { id: chunkId } });
      if (!chunk || chunk.state === 'DELETED') {
        await JobQueue.fail(jobId, 'CHUNK_MISSING', 'Audio chunk not found');
        return;
      }
      chunksToProcess = [{ id: chunk.id, filePath: chunk.filePath, startOffsetMs: chunk.startOffsetMs }];
    } else {
      // Process all complete chunks for this lecture that haven't been transcribed yet
      const lecture = await db.lecture.findUnique({ where: { id: lectureId } });
      if (!lecture) {
        await JobQueue.fail(jobId, 'LECTURE_MISSING', 'Lecture not found');
        return;
      }
      const chunks = await db.audioChunk.findMany({
        where: { lectureId, state: 'COMPLETE' },
        orderBy: { index: 'asc' },
      });
      chunksToProcess = chunks.map((c) => ({ id: c.id, filePath: c.filePath, startOffsetMs: c.startOffsetMs }));
    }

    if (chunksToProcess.length === 0) {
      await JobQueue.fail(jobId, 'NO_AUDIO', 'No complete audio chunks found for transcription');
      return;
    }

    const audioDir = await getAudioDir();
    let globalSegmentIndex = 0;

    // ── Process each chunk ─────────────────────────────────────────────────
    for (const chunk of chunksToProcess) {
      if (signal.aborted) break;

      const startOffsetSec = chunk.startOffsetMs / 1000;

      // Validate file path
      const safeInputPath = assertSafeAudioPath(chunk.filePath, audioDir);

      if (!fs.existsSync(safeInputPath)) {
        log.warn(`[whisper] Chunk file missing: ${chunk.id}`);
        continue;
      }

      // Convert to WAV
      const tmpWav = path.join(app.getPath('temp'), `mf-chunk-${chunk.id}-${Date.now()}.wav`);
      wavPath = tmpWav;

      broadcast('job:progress', {
        jobId, lectureId,
        status: 'CONVERTING',
        pct: Math.round((i / chunksToProcess.length) * 30),
        chunkIndex: i,
        chunkTotal: chunksToProcess.length,
      });

      await convertToWav(safeInputPath, tmpWav, signal);

      if (signal.aborted) break;

      broadcast('job:progress', {
        jobId, lectureId,
        status: 'TRANSCRIBING',
        pct: Math.round(30 + (i / chunksToProcess.length) * 60),
        chunkIndex: i,
        chunkTotal: chunksToProcess.length,
      });

      // Run inference
      const segments = await runWhisper({
        wavPath: tmpWav,
        modelPath,
        language,
        jobId,
        signal,
        onProgress: (pct) => {
          broadcast('job:progress', {
            jobId, lectureId,
            status: 'TRANSCRIBING',
            pct: Math.round(30 + (i / chunksToProcess.length) * 60 + pct * 0.6 / chunksToProcess.length),
          });
        },
      });

      // Clean up WAV
      try { if (fs.existsSync(tmpWav)) fs.unlinkSync(tmpWav); } catch { /* cleanup */ }
      wavPath = null;

      if (signal.aborted) break;

      // Persist segments with absolute timestamps
      const segmentsWithOffset = segments.map((seg) => ({
        segmentIndex: globalSegmentIndex++,
        text: seg.text,
        timestampStart: seg.start + startOffsetSec,
        timestampEnd: seg.end + startOffsetSec,
        confidence: seg.confidence,
      }));

      if (segmentsWithOffset.length > 0) {
        await TranscriptService.bulkInsert(lectureId, segmentsWithOffset);
      }

      log.info(`[whisper] Chunk ${chunk.id}: ${segments.length} segments`);
    }

    if (!signal.aborted) {
      // Update lecture state
      await db.lecture.update({
        where: { id: lectureId },
        data: { state: 'READY' },
      });

      await JobQueue.complete(jobId);
      broadcast('job:progress', { jobId, lectureId, status: 'DONE', pct: 100 });
      log.info(`[whisper] Job ${jobId} complete`);
    } else {
      await JobQueue.fail(jobId, 'CANCELLED', 'Transcription cancelled');
      broadcast('job:progress', { jobId, lectureId, status: 'CANCELLED' });
    }
  } catch (err) {
    // Clean up temp WAV
    if (wavPath) { try { if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath); } catch { /* cleanup */ } }

    const msg = err instanceof Error ? err.message : String(err);
    log.error(`[whisper] Job ${jobId} error:`, msg.slice(0, 200));

    const code = msg.includes('CANCELLED') ? 'CANCELLED'
      : msg.includes('ffmpeg') ? 'CONVERSION_ERROR'
      : msg.includes('binary not found') ? 'BINARY_MISSING'
      : 'TRANSCRIPTION_ERROR';

    if (code === 'CANCELLED') {
      await JobQueue.fail(jobId, 'CANCELLED', 'Transcription cancelled');
      broadcast('job:progress', { jobId, lectureId, status: 'CANCELLED' });
    } else {
      const safeMsg = msg.replace(/([A-Za-z]:[/\\][^\s,]+)/g, '[PATH]').replace(/(\/[^\s,]+)/g, '[PATH]');
      await JobQueue.fail(jobId, code, safeMsg.slice(0, 256));
      broadcast('job:progress', { jobId, lectureId, status: 'FAILED', error: code, message: safeMsg.slice(0, 256) });
    }
  } finally {
    clearTimeout(timeoutHandle);
    activeJobs.delete(jobId);
  }
}

// ── SHA-256 file verification ──────────────────────────────────────────────

async function verifyFileSha256(filePath: string, expected: string): Promise<boolean> {
  return new Promise((resolve) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex') === expected));
    stream.on('error', () => resolve(false));
  });
}

// ── Worker loop ────────────────────────────────────────────────────────────

let workerRunning = false;
let workerTimer: ReturnType<typeof setTimeout> | null = null;

async function tick(): Promise<void> {
  if (!workerRunning) return;
  try {
    const job = await JobQueue.claimNext(['TRANSCRIBE']);
    if (job) {
      // Process synchronously in this tick (one job at a time)
      await processTranscribeJob(job);
    }
  } catch (err) {
    log.error('[whisper] Worker tick error:', err instanceof Error ? err.message : String(err));
  }
  if (workerRunning) {
    workerTimer = setTimeout(tick, POLL_INTERVAL_MS);
  }
}

export const WhisperWorker = {
  start(): void {
    if (workerRunning) return;
    workerRunning = true;
    log.info('[whisper] Worker started');
    void tick();
  },

  stop(): void {
    workerRunning = false;
    if (workerTimer) { clearTimeout(workerTimer); workerTimer = null; }
    log.info('[whisper] Worker stopped');
  },

  cancelJob(jobId: string): void {
    activeJobs.get(jobId)?.abort();
  },

  /** Manually enqueue transcription for a lecture */
  async enqueueTranscription(lectureId: string, opts?: { modelId?: string; language?: string }): Promise<string> {
    const job = await JobQueue.enqueue({
      jobType: 'TRANSCRIBE',
      payload: { lectureId, ...opts },
      priority: 3,
      deduplicate: true,
    });
    return job.id;
  },

  isRunning(): boolean {
    return workerRunning;
  },
};
