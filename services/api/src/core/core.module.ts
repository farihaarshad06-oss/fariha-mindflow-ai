import { Global, Module } from '@nestjs/common';
import {
  UsersRepository,
  CoursesRepository,
  LecturesRepository,
  ProcessingJobsRepository,
  UsageRepository,
  AuditRepository,
  UploadRepository,
  ConsentRepository,
} from './repositories';
import { LoggerService } from './logger.service';
import { PasswordService } from './password.service';
import { JwtService } from './jwt.service';
import { AuditService } from './audit.service';
import { UsageService } from './usage.service';

@Global()
@Module({
  providers: [
    UsersRepository,
    CoursesRepository,
    LecturesRepository,
    ProcessingJobsRepository,
    UsageRepository,
    AuditRepository,
    UploadRepository,
    ConsentRepository,
    LoggerService,
    PasswordService,
    JwtService,
    AuditService,
    UsageService,
  ],
  exports: [
    UsersRepository,
    CoursesRepository,
    LecturesRepository,
    ProcessingJobsRepository,
    UsageRepository,
    AuditRepository,
    UploadRepository,
    ConsentRepository,
    LoggerService,
    PasswordService,
    JwtService,
    AuditService,
    UsageService,
  ],
})
export class CoreModule {}
