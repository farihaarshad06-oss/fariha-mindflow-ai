import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { env } from '../core/env';

export interface UploadRequestInput {
  ownerId: string;
  purpose: 'LECTURE_AUDIO' | 'COURSE_DOCUMENT';
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface UploadDescriptor {
  uploadUrl: string;
  fileId: string;
  expiresInMinutes: number;
}

export interface StorageProvider {
  readonly name: string;
  requestUploadUrl(input: UploadRequestInput): Promise<UploadDescriptor>;
  registerCompleted(fileId: string): Promise<void>;
  deleteFile(fileId: string): Promise<void>;
}

@Injectable()
export class MockStorageProvider implements StorageProvider {
  readonly name = 'mock';

  async requestUploadUrl(input: UploadRequestInput): Promise<UploadDescriptor> {
    const fileId = randomUUID();
    const expiresInMinutes = env.AZURE_STORAGE_SAS_EXPIRY_MINUTES;
    return {
      fileId,
      uploadUrl: `https://mock-storage.local/${input.ownerId}/${input.purpose.toLowerCase()}/${fileId}?sig=mock-sas&expires=${expiresInMinutes}m`,
      expiresInMinutes,
    };
  }

  async registerCompleted(_fileId: string): Promise<void> {
    return;
  }

  async deleteFile(_fileId: string): Promise<void> {
    return;
  }
}

@Injectable()
export class AzureBlobStorageProvider implements StorageProvider {
  readonly name = 'azure-blob';

  async requestUploadUrl(input: UploadRequestInput): Promise<UploadDescriptor> {
    const container =
      input.purpose === 'LECTURE_AUDIO'
        ? env.AZURE_STORAGE_CONTAINER_AUDIO
        : env.AZURE_STORAGE_CONTAINER_DOCUMENTS;
    const fileId = randomUUID();
    const expiresInMinutes = env.AZURE_STORAGE_SAS_EXPIRY_MINUTES;
    const account = env.AZURE_STORAGE_ACCOUNT_NAME as string;
    const path = `${container}/${input.ownerId}/${fileId}`;
    return {
      fileId,
      uploadUrl: `https://${account}.blob.core.windows.net/${path}?sig=<short-lived-sas>&expires=${expiresInMinutes}m`,
      expiresInMinutes,
    };
  }

  async registerCompleted(_fileId: string): Promise<void> {
    return;
  }

  async deleteFile(_fileId: string): Promise<void> {
    return;
  }
}

@Injectable()
export class StorageProviderFactory {
  constructor(
    private readonly mock: MockStorageProvider,
    private readonly azure: AzureBlobStorageProvider,
  ) {}

  resolve(): StorageProvider {
    if (env.AZURE_STORAGE_ACCOUNT_NAME && env.AZURE_STORAGE_SAS_EXPIRY_MINUTES) {
      return this.azure;
    }
    return this.mock;
  }
}
