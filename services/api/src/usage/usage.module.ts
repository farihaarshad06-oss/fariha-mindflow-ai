import { Module } from '@nestjs/common';
import { UsageController } from './usage.controller';
import { AdminUsageService } from './usage.service';

@Module({
  controllers: [UsageController],
  providers: [AdminUsageService],
  exports: [AdminUsageService],
})
export class UsageModule {}
