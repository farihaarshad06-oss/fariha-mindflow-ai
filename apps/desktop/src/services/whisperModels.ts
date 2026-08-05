/**
 * WhisperModelManager — manages local Whisper model files.
 *
 * Uses whisper.cpp GGUF model files downloaded from Hugging Face.
 * Supports: tiny, base, small, medium, large-v2, large-v3
 *
 * Features:
 * - Resumable download (Range header)
 * - SHA-256 integrity verification
 * - Progress reporting via Electron webContents.send
 * - Cancellation via AbortController
 * - Model storage in userData/models/
 */

import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import { app, BrowserWindow } from 'electron';
import log from 'electron-log/main';
import { getPrisma } from './database';

export interface ModelDef {
  id: string;
  name: string;
  sizeBytes: bigint;
  downloadUrl: string;
  sha256: string;
}

// Official whisper.cpp GGUF models from Hugging Face
export const WHISPER_MODELS: ModelDef[] = [
  {
    id: 'tiny',
    name: 'Whisper Tiny (75 MB)',
    sizeBytes: 75_000_000n,
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    sha256: 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21',
  },
  {
    id: 'base',
    name: 'Whisper Base (148 MB)',
    sizeBytes: 148_000_000n,
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
  },
  {
    id: 'small',
    name: 'Whisper Small (488 MB)',
    sizeBytes: 488_000_000n,
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
  },
  {
    id: 'medium',
    name: 'Whisper Medium (1.5 GB)',
    sizeBytes: 1_533_000_000n,
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
    sha256: '6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208',
  },
  {
    id: 'large-v3',
    name: 'Whisper Large v3 (3.1 GB)',
    sizeBytes: 3_094_000_000n,
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
    sha256: 'ad82bf6a9043ceed055076d0fd39f5f186ff8062301f7cd34f3b8a0e22c3a7a1',
  },
];

function getModelsDir(): string {
  const dir = path.join(app.getPath('userData'), 'models');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const activeDownloads = new Map<string, AbortController>();

function sendProgress(modelId: string, downloaded: number, total: number): void {
  const wins = BrowserWindow.getAllWindows();
  for (const win of wins) {
    if (!win.isDestroyed()) {
      win.webContents.send('model:downloadProgress', { modelId, downloaded, total });
    }
  }
}

async function verifyIntegrity(filePath: string, expectedSha256: string): Promise<boolean> {
  return new Promise((resolve) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex') === expectedSha256));
    stream.on('error', () => resolve(false));
  });
}

export const WhisperModelManager = {
  async ensureDefaults(): Promise<void> {
    const db = getPrisma();
    for (const model of WHISPER_MODELS) {
      await db.whisperModel.upsert({
        where: { id: model.id },
        create: {
          id: model.id,
          name: model.name,
          sizeBytes: model.sizeBytes,
          downloadUrl: model.downloadUrl,
          sha256: model.sha256,
          state: 'AVAILABLE',
        },
        update: {
          name: model.name,
          sizeBytes: model.sizeBytes,
          downloadUrl: model.downloadUrl,
          sha256: model.sha256,
        },
      });
    }
  },

  async list() {
    const db = getPrisma();
    const models = await db.whisperModel.findMany({ orderBy: { sizeBytes: 'asc' } });
    // Bigint values are not serializable via Electron structured clone; convert to number.
    return models.map((m) => ({
      ...m,
      sizeBytes: Number(m.sizeBytes),
      downloadedBytes: Number(m.downloadedBytes),
    }));
  },

  async startDownload(modelId: string): Promise<void> {
    const db = getPrisma();
    const model = await db.whisperModel.findUniqueOrThrow({ where: { id: modelId } });
    if (model.state === 'READY') {
      log.info(`[whisper] Model ${modelId} already downloaded`);
      return;
    }

    if (activeDownloads.has(modelId)) {
      log.info(`[whisper] Download already in progress for ${modelId}`);
      return;
    }

    const modelsDir = getModelsDir();
    const filePath = path.join(modelsDir, `ggml-${modelId}.bin`);
    const tmpPath = `${filePath}.download`;

    const controller = new AbortController();
    activeDownloads.set(modelId, controller);

    await db.whisperModel.update({ where: { id: modelId }, data: { state: 'DOWNLOADING' } });

    let startByte = 0;
    if (fs.existsSync(tmpPath)) {
      startByte = fs.statSync(tmpPath).size;
      log.info(`[whisper] Resuming download for ${modelId} at byte ${startByte}`);
    }

    const headers: Record<string, string> = {};
    if (startByte > 0) headers['Range'] = `bytes=${startByte}-`;

    const download = (): Promise<void> => new Promise((resolve, reject) => {
      const url = new URL(model.downloadUrl);
      const proto = url.protocol === 'https:' ? https : http;

      const req = proto.get(model.downloadUrl, { headers }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Follow redirect
          const location = res.headers.location;
          if (!location) { reject(new Error('Redirect with no Location header')); return; }
          const redirected = new URL(location, model.downloadUrl);
          https.get(redirected.toString(), { headers }, handleResponse);
          return;
        }
        handleResponse(res);
      });

      function handleResponse(res: http.IncomingMessage): void {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const total = Number(model.sizeBytes);
        let downloaded = startByte;
        const writeStream = fs.createWriteStream(tmpPath, { flags: startByte > 0 ? 'a' : 'w' });

        res.on('data', (chunk: Buffer) => {
          if (controller.signal.aborted) {
            res.destroy();
            writeStream.close();
            reject(new Error('CANCELLED'));
            return;
          }
          writeStream.write(chunk);
          downloaded += chunk.length;
          sendProgress(modelId, downloaded, total);
          // Persist progress
          void db.whisperModel.update({
            where: { id: modelId },
            data: { downloadedBytes: BigInt(downloaded) },
          }).catch(() => {});
        });

        res.on('end', () => { writeStream.close(); resolve(); });
        res.on('error', reject);
      }

      req.on('error', reject);
    });

    try {
      await download();

      // Verify integrity
      log.info(`[whisper] Verifying integrity for ${modelId}...`);
      const valid = await verifyIntegrity(tmpPath, model.sha256);
      if (!valid) {
        fs.unlinkSync(tmpPath);
        await db.whisperModel.update({ where: { id: modelId }, data: { state: 'ERROR', downloadedBytes: 0n } });
        throw new Error(`Integrity check failed for model ${modelId}`);
      }

      fs.renameSync(tmpPath, filePath);
      await db.whisperModel.update({
        where: { id: modelId },
        data: { state: 'READY', localPath: filePath, downloadedAt: new Date(), downloadedBytes: model.sizeBytes },
      });
      log.info(`[whisper] Model ${modelId} ready at ${filePath}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'CANCELLED') {
        await db.whisperModel.update({ where: { id: modelId }, data: { state: 'AVAILABLE' } });
        log.info(`[whisper] Download cancelled: ${modelId}`);
      } else {
        await db.whisperModel.update({ where: { id: modelId }, data: { state: 'ERROR' } });
        log.error(`[whisper] Download failed for ${modelId}:`, msg);
      }
    } finally {
      activeDownloads.delete(modelId);
    }
  },

  cancelDownload(modelId: string): void {
    activeDownloads.get(modelId)?.abort();
  },

  async deleteModel(modelId: string): Promise<void> {
    const db = getPrisma();
    const model = await db.whisperModel.findUnique({ where: { id: modelId } });
    if (model?.localPath && fs.existsSync(model.localPath)) {
      fs.unlinkSync(model.localPath);
    }
    await db.whisperModel.update({
      where: { id: modelId },
      data: { state: 'AVAILABLE', localPath: null, downloadedAt: null, downloadedBytes: 0n },
    });
    log.info(`[whisper] Deleted model ${modelId}`);
  },

  async getReadyModel(modelId?: string): Promise<{ id: string; localPath: string } | null> {
    const db = getPrisma();
    const settings = await db.settings.findUnique({ where: { id: 'default' } });
    const targetId = modelId ?? settings?.whisperModelId ?? 'base';
    const model = await db.whisperModel.findUnique({ where: { id: targetId } });
    if (model?.state === 'READY' && model.localPath) {
      return { id: model.id, localPath: model.localPath };
    }
    return null;
  },
};
