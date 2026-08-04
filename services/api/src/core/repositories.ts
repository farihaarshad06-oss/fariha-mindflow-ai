import { Injectable } from '@nestjs/common';
import {
  Prisma,
  PrismaClient,
  type AuditLog as PrismaAuditLog,
  type ConsentRecord as PrismaConsentRecord,
  type Course as PrismaCourse,
  type Lecture as PrismaLecture,
  type ProcessingJob as PrismaProcessingJob,
  type UsageEvent as PrismaUsageEvent,
  type User as PrismaUser,
} from '@prisma/client';
import type { AuditLog, ConsentRecord, Course, Lecture, ProcessingJob, UsageEvent, User } from '@mindflow/types';

export type StoredUser = User & { passwordHash: string };
export type StoredLecture = Lecture & { transcript?: string | null; consentAcknowledged: boolean };
export type StoredConsent = ConsentRecord;

@Injectable()
export class PrismaService extends PrismaClient {}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: Omit<StoredUser, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<StoredUser> {
    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        fullName: input.fullName,
        passwordHash: input.passwordHash,
        roles: input.roles as Prisma.InputJsonValue,
        status: 'PENDING_VERIFICATION',
      },
    });
    return toStoredUser(user);
  }

  async findByEmail(email: string): Promise<StoredUser | undefined> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return user ? toStoredUser(user) : undefined;
  }

  async findById(id: string): Promise<StoredUser | undefined> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? toStoredUser(user) : undefined;
  }

  async save(user: StoredUser): Promise<StoredUser> {
    const saved = await this.prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email.toLowerCase(),
        fullName: user.fullName,
        passwordHash: user.passwordHash,
        roles: user.roles as Prisma.InputJsonValue,
        status: user.status,
      },
      create: {
        id: user.id,
        email: user.email.toLowerCase(),
        fullName: user.fullName,
        passwordHash: user.passwordHash,
        roles: user.roles as Prisma.InputJsonValue,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
    return toStoredUser(saved);
  }

  async list(): Promise<StoredUser[]> {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map(toStoredUser);
  }
}

@Injectable()
export class CoursesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByOwner(ownerId: string): Promise<Course[]> {
    const courses = await this.prisma.course.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
    });
    return courses.map(toCourse);
  }

  async findById(id: string): Promise<Course | undefined> {
    const course = await this.prisma.course.findUnique({ where: { id } });
    return course ? toCourse(course) : undefined;
  }

  async getForOwner(id: string, ownerId: string): Promise<Course | undefined> {
    const course = await this.prisma.course.findFirst({ where: { id, ownerId } });
    return course ? toCourse(course) : undefined;
  }

  async create(input: { title: string; description?: string; color?: string; nextExamDate?: string; ownerId: string }): Promise<Course> {
    const course = await this.prisma.course.create({
      data: {
        ownerId: input.ownerId,
        title: input.title,
        description: input.description,
        color: input.color,
        nextExamDate: input.nextExamDate ? new Date(input.nextExamDate) : null,
        lectureCount: 0,
        weakTopics: Prisma.JsonNull,
        progress: 0,
      },
    });
    return toCourse(course);
  }

  async remove(id: string, ownerId: string): Promise<{ id: string }> {
    await this.prisma.course.deleteMany({ where: { id, ownerId } });
    return { id };
  }
}

@Injectable()
export class LecturesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: Omit<StoredLecture, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoredLecture> {
    const lecture = await this.prisma.lecture.create({
      data: {
        title: input.title,
        ownerId: input.ownerId,
        courseId: input.courseId ?? null,
        state: input.state,
        transcript: input.transcript ?? null,
        consentAcknowledged: input.consentAcknowledged,
      },
    });
    return toStoredLecture(lecture);
  }

  async findById(id: string): Promise<StoredLecture | undefined> {
    const lecture = await this.prisma.lecture.findUnique({ where: { id } });
    return lecture ? toStoredLecture(lecture) : undefined;
  }

  async findByIdWithOwner(id: string, ownerId: string): Promise<StoredLecture | undefined> {
    const lecture = await this.prisma.lecture.findFirst({ where: { id, ownerId } });
    return lecture ? toStoredLecture(lecture) : undefined;
  }

  async listByOwner(ownerId: string): Promise<StoredLecture[]> {
    const lectures = await this.prisma.lecture.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
    });
    return lectures.map(toStoredLecture);
  }

  async list(): Promise<StoredLecture[]> {
    const lectures = await this.prisma.lecture.findMany({ orderBy: { updatedAt: 'desc' } });
    return lectures.map(toStoredLecture);
  }

  async save(lecture: StoredLecture): Promise<StoredLecture> {
    const saved = await this.prisma.lecture.update({
      where: { id: lecture.id },
      data: {
        title: lecture.title,
        courseId: lecture.courseId ?? null,
        ownerId: lecture.ownerId,
        state: lecture.state,
        transcript: lecture.transcript ?? null,
        consentAcknowledged: lecture.consentAcknowledged,
      },
    });
    return toStoredLecture(saved);
  }

  async remove(id: string, ownerId: string): Promise<void> {
    await this.prisma.lecture.deleteMany({ where: { id, ownerId } });
  }
}

@Injectable()
export class ProcessingJobsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: Omit<ProcessingJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProcessingJob> {
    const job = await this.prisma.processingJob.create({ data: input });
    return toProcessingJob(job);
  }

  async findById(id: string): Promise<ProcessingJob | undefined> {
    const job = await this.prisma.processingJob.findUnique({ where: { id } });
    return job ? toProcessingJob(job) : undefined;
  }

  async list(): Promise<ProcessingJob[]> {
    const jobs = await this.prisma.processingJob.findMany({ orderBy: { updatedAt: 'desc' } });
    return jobs.map(toProcessingJob);
  }

  async save(job: ProcessingJob): Promise<ProcessingJob> {
    const saved = await this.prisma.processingJob.update({
      where: { id: job.id },
      data: {
        ownerId: job.ownerId,
        lectureId: job.lectureId,
        type: job.type,
        status: job.status,
        provider: job.provider,
        progress: job.progress,
        errorMessage: job.errorMessage ?? null,
      },
    });
    return toProcessingJob(saved);
  }
}

@Injectable()
export class UsageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: Omit<UsageEvent, 'id' | 'recordedAt'>): Promise<UsageEvent> {
    const event = await this.prisma.usageEvent.create({ data: input });
    return toUsageEvent(event);
  }

  async list(): Promise<UsageEvent[]> {
    const events = await this.prisma.usageEvent.findMany({ orderBy: { recordedAt: 'desc' } });
    return events.map(toUsageEvent);
  }
}

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog> {
    const log = await this.prisma.auditLog.create({ data: input });
    return toAuditLog(log);
  }

  async list(): Promise<AuditLog[]> {
    const logs = await this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' } });
    return logs.map(toAuditLog);
  }
}

@Injectable()
export class ConsentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: Omit<StoredConsent, 'id' | 'createdAt'>): Promise<StoredConsent> {
    const record = await this.prisma.consentRecord.create({ data: input });
    return toConsentRecord(record);
  }

  async listByUser(userId: string): Promise<StoredConsent[]> {
    const records = await this.prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toConsentRecord);
  }
}

@Injectable()
export class UploadRepository {
  constructor(private readonly prisma: PrismaService) {}
}

function toStoredUser(user: PrismaUser): StoredUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: toStringArray(user.roles),
    status: user.status as StoredUser['status'],
    passwordHash: user.passwordHash,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function toCourse(course: PrismaCourse): Course {
  return {
    id: course.id,
    ownerId: course.ownerId,
    title: course.title,
    description: course.description ?? undefined,
    color: course.color ?? undefined,
    nextExamDate: course.nextExamDate?.toISOString(),
    lectureCount: course.lectureCount,
    weakTopics: toStringArray(course.weakTopics),
    progress: course.progress,
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
  };
}

function toStoredLecture(lecture: PrismaLecture): StoredLecture {
  return {
    id: lecture.id,
    title: lecture.title,
    courseId: lecture.courseId ?? undefined,
    ownerId: lecture.ownerId,
    state: lecture.state as StoredLecture['state'],
    transcript: lecture.transcript ?? undefined,
    consentAcknowledged: lecture.consentAcknowledged,
    createdAt: lecture.createdAt.toISOString(),
    updatedAt: lecture.updatedAt.toISOString(),
  };
}

function toProcessingJob(job: PrismaProcessingJob): ProcessingJob {
  return {
    id: job.id,
    ownerId: job.ownerId,
    lectureId: job.lectureId,
    type: job.type as ProcessingJob['type'],
    status: job.status as ProcessingJob['status'],
    provider: job.provider,
    progress: job.progress,
    errorMessage: job.errorMessage ?? undefined,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

function toUsageEvent(event: PrismaUsageEvent): UsageEvent {
  return {
    id: event.id,
    userId: event.userId,
    kind: event.kind as UsageEvent['kind'],
    amount: event.amount,
    meta: toRecord(event.meta),
    recordedAt: event.recordedAt.toISOString(),
  };
}

function toAuditLog(log: PrismaAuditLog): AuditLog {
  return {
    id: log.id,
    actorId: log.actorId,
    actorType: log.actorType as AuditLog['actorType'],
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId ?? undefined,
    metadata: toRecord(log.metadata),
    requestId: log.requestId ?? undefined,
    createdAt: log.createdAt.toISOString(),
  };
}

function toConsentRecord(record: PrismaConsentRecord): StoredConsent {
  return {
    id: record.id,
    userId: record.userId,
    purpose: record.purpose as StoredConsent['purpose'],
    acknowledged: record.acknowledged,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
  };
}

function toStringArray(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function toRecord(value: Prisma.JsonValue | null): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}
