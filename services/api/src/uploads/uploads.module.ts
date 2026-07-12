import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import {
  MockStorageProvider,
  AzureBlobStorageProvider,
  StorageProviderFactory,
} from './storage.provider';

@Module({
  controllers: [UploadsController],
  providers: [
    MockStorageProvider,
    AzureBlobStorageProvider,
    StorageProviderFactory,
    UploadsService,
  ],
  exports: [UploadsService],
})
export class UploadsModule {}
