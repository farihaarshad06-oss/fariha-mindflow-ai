import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { LecturesModule } from './lectures/lectures.module';
import { ProcessingJobsModule } from './processing-jobs/processing-jobs.module';
import { UploadsModule } from './uploads/uploads.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { UsageModule } from './usage/usage.module';

@Module({
  imports: [
    CommonModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    LecturesModule,
    ProcessingJobsModule,
    UploadsModule,
    AuditLogsModule,
    UsageModule,
  ],
})
export class AppModule {}
