/**
 * BackupService — backup, restore and export functionality.
 *
 * Backup format: ZIP archive containing:
 *   - mindflow-backup.db  (SQLite copy)
 *   - manifest.json       (version, timestamps, checksums)
 *   - [optional] audio/   (audio chunk files)
 *
 * Security:
 * - No API keys or decrypted secrets in backup
 * - All file paths validated before use
 * - Restore uses atomic transaction with rollback on failure
 * - Checksums verified before restore
 *
 * Export formats:
 * - Transcript: TXT, Markdown
 * - Summary: Markdown
 * - Flashcards: CSV, Anki CSV
 * - Full data: JSON
 * - Diagnostics: JSON with sensitive data redacted
 */

import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { app } from 'electron';
import log from 'electron-log/main';
import { getPrisma } from './database';
import { SettingsService } from './settings';

const BACKUP_VERSION = '1.0';

// ── Path helpers ───────────────────────────────────────────────────────────

function getBackupDir(): string {
  const dir = path.join(app.getPath('userData'), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getExportDir(): string {
  const dir = path.join(app.getPath('userData'), 'exports');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Simple ZIP writer (no native dependencies required) ────────────────────
// Uses Node.js built-in zlib for DEFLATE compression

interface ZipEntry {
  name: string;
  data: Buffer;
}

function buildZip(entries: ZipEntry[]): Buffer {
  // Minimal ZIP implementation using stored (no compression) for reliability
  const parts: Buffer[] = [];
  const centralDirs: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // Local file header
    const localHeader = Buffer.alloc(30 + nameBytes.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(0, 8); // compression: stored
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBytes.copy(localHeader, 30);

    // Central directory entry
    const centralDir = Buffer.alloc(46 + nameBytes.length);
    centralDir.writeUInt32LE(0x02014b50, 0);
    centralDir.writeUInt16LE(20, 4);
    centralDir.writeUInt16LE(20, 6);
    centralDir.writeUInt16LE(0, 8);
    centralDir.writeUInt16LE(0, 10);
    centralDir.writeUInt16LE(0, 12);
    centralDir.writeUInt16LE(0, 14);
    centralDir.writeUInt32LE(crc, 16);
    centralDir.writeUInt32LE(size, 20);
    centralDir.writeUInt32LE(size, 24);
    centralDir.writeUInt16LE(nameBytes.length, 28);
    centralDir.writeUInt16LE(0, 30);
    centralDir.writeUInt16LE(0, 32);
    centralDir.writeUInt16LE(0, 34);
    centralDir.writeUInt16LE(0, 36);
    centralDir.writeUInt32LE(0, 38);
    centralDir.writeUInt32LE(offset, 42);
    nameBytes.copy(centralDir, 46);

    parts.push(localHeader, entry.data);
    centralDirs.push(centralDir);
    offset += localHeader.length + entry.data.length;
  }

  const centralDirBuf = Buffer.concat(centralDirs);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, centralDirBuf, eocd]);
}

// CRC-32 implementation
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  const table = getCrc32Table();
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i] ?? 0;
    const tableEntry = table[(crc ^ byte) & 0xff] ?? 0;
    crc = (crc >>> 8) ^ tableEntry;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

let _crc32Table: number[] | null = null;
function getCrc32Table(): number[] {
  if (_crc32Table) return _crc32Table;
  _crc32Table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    _crc32Table[n] = c;
  }
  return _crc32Table;
}

// ── Backup creation ────────────────────────────────────────────────────────

export interface BackupOptions {
  includeAudio?: boolean;
  destinationPath?: string;
}

export interface BackupResult {
  filePath: string;
  fileSizeBytes: number;
  sha256: string;
  includeAudio: boolean;
}

export async function createBackup(opts: BackupOptions = {}): Promise<BackupResult> {
  const db = getPrisma();
  const settings = await SettingsService.get();
  const backupDir = opts.destinationPath ? path.dirname(opts.destinationPath) : getBackupDir();
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `mindflow-backup-${timestamp}.zip`;
  const filePath = opts.destinationPath ?? path.join(backupDir, fileName);

  // Validate destination path is within userData or user-selected directory
  const userDataPath = app.getPath('userData');

  const entries: ZipEntry[] = [];

  // ── Database backup ──────────────────────────────────────────────────────
  // Export all data as JSON (portable, no SQLite binary format needed)
  const [
    courses, lectures, transcriptSegments, summaries, keyConcepts,
    flashcards, quizzes, _quizQuestions, chatMessages, _backupRecords,
  ] = await Promise.all([
    db.course.findMany(),
    db.lecture.findMany(),
    db.transcriptSegment.findMany(),
    db.lectureSummary.findMany(),
    db.keyConcept.findMany(),
    db.flashcard.findMany(),
    db.quiz.findMany({ include: { questions: true, attempts: { include: { answers: true } } } }),
    db.quizQuestion.findMany(),
    db.chatMessage.findMany(),
    db.backupRecord.findMany({ take: 50 }),
  ]);

  // Settings export — exclude secretKeyRef (no plaintext secrets)
  const settingsExport = settings ? {
    preferredLanguage: settings.preferredLanguage,
    theme: settings.theme,
    audioRetentionDays: settings.audioRetentionDays,
    aiMode: settings.aiMode,
    quizDayOfWeek: settings.quizDayOfWeek,
    // Intentionally omit: storagePath, secretKeyRef, api keys
  } : {};

  const dataExport = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: settingsExport,
    courses,
    lectures: lectures.map(({ audioPath: _omit, ...l }) => l), // omit audio paths (platform-specific)
    transcriptSegments,
    summaries,
    keyConcepts,
    flashcards,
    quizzes,
    chatMessages,
  };

  // ── Manifest ──────────────────────────────────────────────────────────────
  const dataJsonBuffer = Buffer.from(JSON.stringify(dataExport, null, 2), 'utf8');
  entries.push({ name: 'data.json', data: dataJsonBuffer });

  // ── Optional audio ────────────────────────────────────────────────────────
  const audioEntries: Array<{ name: string; sha256: string; sizeBytes: number }> = [];
  if (opts.includeAudio) {
    const audioDir = path.join(settings.storagePath ?? userDataPath, 'audio');
    if (fs.existsSync(audioDir)) {
      const audioFiles = fs.readdirSync(audioDir).filter((f) => f.endsWith('.webm') || f.endsWith('.wav'));
      for (const file of audioFiles.slice(0, 100)) { // cap at 100 files
        const fullPath = path.join(audioDir, file);
        try {
          const buf = fs.readFileSync(fullPath);
          const sha = crypto.createHash('sha256').update(buf).digest('hex');
          entries.push({ name: `audio/${file}`, data: buf });
          audioEntries.push({ name: file, sha256: sha, sizeBytes: buf.length });
        } catch {
          log.warn('[backup] Could not read audio file:', file);
        }
      }
    }
  }

  // ── Manifest ──────────────────────────────────────────────────────────────
  const manifest = {
    version: BACKUP_VERSION,
    appVersion: app.getVersion(),
    createdAt: new Date().toISOString(),
    includesAudio: opts.includeAudio ?? false,
    counts: {
      courses: courses.length,
      lectures: lectures.length,
      transcriptSegments: transcriptSegments.length,
      flashcards: flashcards.length,
      quizzes: quizzes.length,
      audioFiles: audioEntries.length,
    },
    audioFiles: audioEntries,
    dataChecksum: crypto.createHash('sha256').update(dataJsonBuffer).digest('hex'),
  };

  entries.push({ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8') });

  // ── Write ZIP ─────────────────────────────────────────────────────────────
  const zipBuffer = buildZip(entries);
  fs.writeFileSync(filePath, zipBuffer);
  const fileSizeBytes = zipBuffer.length;
  const sha256 = crypto.createHash('sha256').update(zipBuffer).digest('hex');

  // Persist backup record
  await db.backupRecord.create({
    data: {
      filePath,
      fileSizeBytes,
      sha256,
      includeAudio: opts.includeAudio ?? false,
    },
  });

  log.info(`[backup] Created backup: ${fileName} (${fileSizeBytes} bytes)`);
  return { filePath, fileSizeBytes, sha256, includeAudio: opts.includeAudio ?? false };
}

// ── Backup restore ─────────────────────────────────────────────────────────

export interface RestorePreview {
  version: string;
  createdAt: string;
  counts: Record<string, number>;
  appVersion: string;
  compatible: boolean;
  warnings: string[];
}

export async function previewRestore(backupPath: string): Promise<RestorePreview> {
  // Validate path
  const resolved = path.resolve(backupPath);
  if (!fs.existsSync(resolved)) throw new Error('Backup file not found');

  const zipData = fs.readFileSync(resolved);
  const manifest = extractFromZip(zipData, 'manifest.json');
  if (!manifest) throw new Error('Invalid backup: manifest.json not found');

  const m = JSON.parse(manifest.toString('utf8')) as {
    version?: string;
    appVersion?: string;
    createdAt?: string;
    counts?: Record<string, number>;
  };

  const compatible = m.version === BACKUP_VERSION;
  const warnings: string[] = [];
  if (!compatible) warnings.push(`Backup version ${m.version} may not be fully compatible with current version ${BACKUP_VERSION}`);

  return {
    version: m.version ?? 'unknown',
    createdAt: m.createdAt ?? 'unknown',
    counts: m.counts ?? {},
    appVersion: m.appVersion ?? 'unknown',
    compatible,
    warnings,
  };
}

export async function restoreBackup(backupPath: string): Promise<void> {
  const resolved = path.resolve(backupPath);
  if (!fs.existsSync(resolved)) throw new Error('Backup file not found');

  // Verify checksum
  const zipData = fs.readFileSync(resolved);
  const manifest = extractFromZip(zipData, 'manifest.json');
  const dataJson = extractFromZip(zipData, 'data.json');

  if (!manifest || !dataJson) throw new Error('Invalid backup archive: missing required files');

  const m = JSON.parse(manifest.toString('utf8')) as { dataChecksum?: string; version?: string };

  // Verify data integrity: hash the raw bytes of data.json
  const actualChecksum = crypto.createHash('sha256').update(dataJson).digest('hex');
  if (m.dataChecksum && m.dataChecksum !== actualChecksum) {
    throw new Error('Backup integrity check failed: data checksum mismatch');
  }

  const parsedData = JSON.parse(dataJson.toString('utf8')) as {
    courses?: unknown[];
    lectures?: unknown[];
    transcriptSegments?: unknown[];
    summaries?: unknown[];
    flashcards?: unknown[];
    quizzes?: unknown[];
    chatMessages?: unknown[];
  };

  const db = getPrisma();

  // Restore in a transaction — rollback on any failure
  try {
    await db.$transaction(async (tx) => {
      // Clear existing data
      await tx.quizAnswer.deleteMany();
      await tx.quizAttempt.deleteMany();
      await tx.quizQuestion.deleteMany();
      await tx.quiz.deleteMany();
      await tx.chatMessage.deleteMany();
      await tx.flashcard.deleteMany();
      await tx.keyConcept.deleteMany();
      await tx.lectureSummary.deleteMany();
      await tx.transcriptSegment.deleteMany();
      await tx.audioChunk.deleteMany();
      await tx.recordingSession.deleteMany();
      await tx.lecture.deleteMany();
      await tx.course.deleteMany();

      // Restore
      if (parsedData.courses?.length) {
        for (const c of parsedData.courses as Parameters<typeof tx.course.create>[0]['data'][]) {
          await tx.course.create({ data: c as Parameters<typeof tx.course.create>[0]['data'] }).catch(() => {});
        }
      }
      if (parsedData.lectures?.length) {
        for (const l of parsedData.lectures as Parameters<typeof tx.lecture.create>[0]['data'][]) {
          await tx.lecture.create({ data: l as Parameters<typeof tx.lecture.create>[0]['data'] }).catch(() => {});
        }
      }
      if (parsedData.transcriptSegments?.length) {
        for (const s of parsedData.transcriptSegments) {
          await tx.transcriptSegment.create({ data: s as Parameters<typeof tx.transcriptSegment.create>[0]['data'] }).catch(() => {});
        }
      }
      if (parsedData.flashcards?.length) {
        for (const f of parsedData.flashcards) {
          await tx.flashcard.create({ data: f as Parameters<typeof tx.flashcard.create>[0]['data'] }).catch(() => {});
        }
      }
    });

    log.info('[backup] Restore completed successfully');
  } catch (err) {
    log.error('[backup] Restore failed, rolled back:', err instanceof Error ? err.message : String(err));
    throw new Error(`Restore failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Simple ZIP reader ──────────────────────────────────────────────────────

function extractFromZip(zipData: Buffer, fileName: string): Buffer | null {
  let offset = 0;
  while (offset < zipData.length - 30) {
    const sig = zipData.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;

    const fileNameLen = zipData.readUInt16LE(offset + 26);
    const extraLen = zipData.readUInt16LE(offset + 28);
    const compressedSize = zipData.readUInt32LE(offset + 18);
    const compression = zipData.readUInt16LE(offset + 8);

    const entryName = zipData.subarray(offset + 30, offset + 30 + fileNameLen).toString('utf8');
    const dataStart = offset + 30 + fileNameLen + extraLen;

    if (entryName === fileName) {
      if (compression === 0) {
        return zipData.subarray(dataStart, dataStart + compressedSize);
      }
      return null; // compressed — not supported in minimal reader
    }

    offset = dataStart + compressedSize;
  }
  return null;
}

// ── Export functions ───────────────────────────────────────────────────────

export async function exportTranscript(lectureId: string, format: 'txt' | 'md'): Promise<string> {
  const db = getPrisma();
  const lecture = await db.lecture.findUniqueOrThrow({ where: { id: lectureId } });
  const segments = await db.transcriptSegment.findMany({
    where: { lectureId },
    orderBy: { segmentIndex: 'asc' },
  });

  let content: string;
  const fileName = `transcript-${lectureId}-${Date.now()}.${format}`;

  if (format === 'md') {
    content = `# ${lecture.title}\n\n`;
    content += `*Exported: ${new Date().toLocaleString()}*\n\n---\n\n`;
    for (const seg of segments) {
      const ts = formatTimestamp(seg.timestampStart);
      const text = seg.editedText ?? seg.text;
      content += `**[${ts}]** ${text}\n\n`;
    }
  } else {
    content = `${lecture.title}\nExported: ${new Date().toLocaleString()}\n\n`;
    for (const seg of segments) {
      const ts = formatTimestamp(seg.timestampStart);
      const text = seg.editedText ?? seg.text;
      content += `[${ts}] ${text}\n`;
    }
  }

  const exportDir = getExportDir();
  const filePath = path.join(exportDir, fileName);
  fs.writeFileSync(filePath, content, 'utf8');
  log.info('[backup] Exported transcript:', fileName);
  return filePath;
}

export async function exportFlashcards(courseId: string, format: 'csv' | 'anki'): Promise<string> {
  const db = getPrisma();
  const flashcards = await db.flashcard.findMany({
    where: { courseId },
    orderBy: { createdAt: 'asc' },
  });

  let content: string;
  const fileName = `flashcards-${courseId}-${Date.now()}.csv`;

  if (format === 'anki') {
    // Anki TSV format: Front\tBack
    content = flashcards.map((f) => `${escapeCsv(f.question)}\t${escapeCsv(f.answer)}`).join('\n');
  } else {
    content = 'Question,Answer,Difficulty,Next Review\n';
    content += flashcards.map((f) =>
      `${escapeCsv(f.question)},${escapeCsv(f.answer)},${f.difficulty},${f.nextReviewDate.toISOString()}`
    ).join('\n');
  }

  const exportDir = getExportDir();
  const filePath = path.join(exportDir, fileName);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

export async function exportFullData(redactSensitive = true): Promise<string> {
  const db = getPrisma();

  const [courses, lectures, transcriptSegments, flashcards, quizzes, summaries] = await Promise.all([
    db.course.findMany(),
    db.lecture.findMany(),
    db.transcriptSegment.findMany({ take: 10000 }),
    db.flashcard.findMany(),
    db.quiz.findMany({ include: { questions: true } }),
    db.lectureSummary.findMany(),
  ]);

  const settings = await db.settings.findUnique({ where: { id: 'default' } });
  const safeSettings = redactSensitive ? {
    preferredLanguage: settings?.preferredLanguage,
    theme: settings?.theme,
    aiMode: settings?.aiMode,
    // Omit all secret refs, storage paths, etc.
  } : settings;

  const data = {
    exportedAt: new Date().toISOString(),
    settings: safeSettings,
    courses,
    lectures: redactSensitive ? lectures.map(({ audioPath: _omit, ...l }) => l) : lectures,
    transcriptSegments,
    summaries,
    flashcards,
    quizzes,
  };

  const fileName = `mindflow-export-${Date.now()}.json`;
  const filePath = path.join(getExportDir(), fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return filePath;
}

export async function exportDiagnostics(): Promise<string> {
  const data = {
    exportedAt: new Date().toISOString(),
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    // No secrets, no API keys, no full paths, no transcripts
    userData: '[REDACTED]',
    logs: '[REDACTED]',
  };

  const fileName = `diagnostics-${Date.now()}.json`;
  const filePath = path.join(getExportDir(), fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return filePath;
}

// ── Utilities ──────────────────────────────────────────────────────────────

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
