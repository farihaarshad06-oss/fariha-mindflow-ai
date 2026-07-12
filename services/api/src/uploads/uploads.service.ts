import { Injectable, BadRequestException } from '@nestjs/common';
import { FILE_LIMITS } from '@mindflow/config';
import { UploadRepository, type StoredUpload } from '../core/repositories';
import {
  StorageProviderFactory,
  type UploadRequestInput,
} from './storage.provider';
import type { UploadRequestDto } from './uploads.dto';

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : '';
}

@Injectable()
export class UploadsService {
  constructor(
    private readonly uploads: UploadRepository,
    private readonly storageFactory: StorageProviderFactory,
  ) {}

  async requestUpload(ownerId: string, dto: UploadRequestDto) {
    this.validateMetadata(dto);
    const provider = this.storageFactory.resolve();
    const descriptor = await provider.requestUploadUrl({
      ownerId,
      purpose: dto.purpose,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize,
    } as UploadRequestInput);
    const stored: StoredUpload = this.uploads.create({
      ownerId,
      purpose: dto.purpose,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize,
      uploadUrl: descriptor.uploadUrl,
    });
    return {
      fileId: stored.id,
      uploadUrl: descriptor.uploadUrl,
      expiresInMinutes: descriptor.expiresInMinutes,
      provider: provider.name,
    };
  }

  async completeUpload(fileId: string, ownerId: string) {
    const stored = this.uploads.findById(fileId);
    if (!stored) throw new BadRequestException('Upload not found.');
    if (stored.ownerId !== ownerId) throw new BadRequestException('Upload ownership mismatch.');
    stored.status = 'COMPLETED';
    this.uploads.save(stored);
    await this.storageFactory.resolve().registerCompleted(fileId);
    return { id: stored.id, status: stored.status };
  }

  async deleteUpload(fileId: string, ownerId: string) {
    const stored = this.uploads.findById(fileId);
    if (!stored) throw new BadRequestException('Upload not found.');
    if (stored.ownerId !== ownerId) throw new BadRequestException('Upload ownership mismatch.');
    stored.status = 'DELETED';
    this.uploads.save(stored);
    await this.storageFactory.resolve().deleteFile(fileId);
    return { id: stored.id, status: stored.status };
  }

  private validateMetadata(dto: UploadRequestDto): void {
    if (!ALLOWED_LIST.includes(dto.mimeType)) {
      throw new BadRequestException(`Unsupported MIME type: ${dto.mimeType}`);
    }
    const extension = extensionOf(dto.fileName);
    const allowedExtensions =
      dto.purpose === 'LECTURE_AUDIO'
        ? FILE_LIMITS.allowedAudioExtensions
        : FILE_LIMITS.allowedDocumentExtensions;
    if (!allowedExtensions.includes(extension as never)) {
      throw new BadRequestException(`Unsupported file extension: .${extension}`);
    }
    const maxBytes =
      dto.purpose === 'LECTURE_AUDIO' ? FILE_LIMITS.maxAudioBytes : FILE_LIMITS.maxDocumentBytes;
    if (dto.fileSize > maxBytes) {
      throw new BadRequestException('File exceeds the maximum allowed size.');
    }
  }
}

const ALLOWED_LIST = FILE_LIMITS.allowedMimeTypes as readonly string[];
