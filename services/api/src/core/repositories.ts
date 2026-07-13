import { PrismaClient } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { JwtService } from '../core/jwt.service';
import { UsersRepository } from './users.service';
import { CoursesRepository } from './courses.service';
import { LecturesRepository } from './lectures.service';
import { ProcessingJobsRepository } from './processing-jobs.service';
import { UsageRepository } from './usage.service';
import { AuditRepository } from './audit.service';
import { ConsentRepository } from './consent.service';
import type { User, Course, Lecture, ProcessingJob, UsageEvent, AuditLog, ConsentRecord, UserProfile } from '@mindflow/types';

@Injectable()
export class UsersRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async create(input: Omit<StoredUser, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<StoredUser> {
    const now = new Date().toISOString();
    const user = await this.prisma.user.create({
      data: {
        ...input,
        status: 'PENDING_VERIFICATION',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return toPublicUser(user);
  }

  async findByEmail(email: string): Promise<StoredUser | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (user) {
      return toPublicUser(user);
    }
    return undefined;
  }

  async findById(id: string): Promise<StoredUser | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (user) {
      return toPublicUser(user);
    }
    return undefined;
  }

  async save(user: StoredUser): Promise<StoredUser> {
    const existing = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (user) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          ...user,
          updatedAt: new Date().toISOString(),
        },
      });
    } else {
      await this.prisma.user.create({
        data: {
          ...user,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }
    return toPublicUser(await this.prisma.user.findUnique({ where: { id: user.id } }));
  }

  async list(): Promise<StoredUser[]> {
    const users = await this.prisma.user.findMany();
    return users.map(toPublicUser);
  }
}

export class CoursesRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async create(input: Omit<Course, 'id' | 'createdAt' | 'updatedAt' | 'lectureCount' | 'weakTopics' | 'progress'>): Promise<Course> {
    const now = new Date().toISOString();
    const course = await this.prisma.course.create({
      data: {
        ...input,
        lectureCount: 0,
        weakTopics: [],
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return this.toPublicCourse(course);
  }

  async findById(id: string): Promise<Course | undefined> {
    const course = await this.prisma.course.findUnique({
      where: { id },
    });
    if (course) {
      return this.toPublicCourse(course);
    }
    return undefined;
  }

  async getForOwner(id: string, ownerId: string): Promise<Course> {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { owner: true },
    });
    if (course && course.ownerId === ownerId) {
      return this.toPublicCourse(course);
    }
    throw new Error('Access denied');
  }

  async create(input: { title: string; description?: string; color?: string; nextExamDate?: string }, ownerId: string): Promise<Course> {
    const now = new Date().toISOString();
    const course = await this.prisma.course.create({
      data: {
        ...input,
        ownerId,
        lectureCount: 0,
        weakTopics: [],
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return this.toPublicCourse(course);
  }

  async remove(id: string, ownerId: string): Promise<{ id: string }> {
    const course = await this.prisma.course.findUnique({
      where: { id },
    });
    if (!course) {
      throw new Error('Course not found');
    }
    if (course.ownerId !== ownerId) {
      throw new Error('Access denied');
    }
    await this.prisma.course.delete({ where: { id } });
    return { id };
  }
}

export class LecturesRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async create(input: Omit<StoredLecture, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoredLecture> {
    const now = new Date().toISOString();
    const lecture = await this.prisma.lecture.create({
      data: {
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return this.toStoredLecture(lecture);
  }

  async findById(id: string): Promise<StoredLecture | undefined> {
    const lecture = await this.prisma.lecture.findUnique({
      where: { id },
    });
    if (lecture) {
      return this.toStoredLecture(lecture);
    }
    return undefined;
  }

  async findByIdWithOwner(id: string, ownerId: string): Promise<StoredLecture | undefined> {
    const lecture = await this.prisma.lecture.findUnique({
      where: { id },
      include: { owner: true },
    });
    if (lecture) {
      if (lecture.ownerId === ownerId) {
        return this.toStoredLecture(lecture);
      } else {
        throw new Error('Access denied');
      }
    }
    return undefined;
  }

  async listByOwner(ownerId: string): Promise<StoredLecture[]> {
    return this.prisma.lecture.findMany({
      where: { ownerId },
    }).then(lectures => lectures.map(this.toStoredLecture));
  }

  async list(): Promise<StoredLecture[]> {
    return this.prisma.lecture.findMany().then(lectures => lectures.map(this.toStoredLecture));
  }

  async save(lecture: StoredLecture): Promise<StoredLecture> {
    const existing = await this.prisma.lecture.findUnique({ where: { id: lecture.id } });
    if (existing) {
      return this.prisma.lecture.update({
        where: { id: lecture.id },
        data: {
          ...lecture,
          updatedAt: new Date().toISOString(),
        },
      });
    } else {
      return this.prisma.lecture.create({
        data: {
          ...lecture,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const lecture = await this.prisma.lecture.findUnique({
      where: { id },
    });
    if (!lecture) {
      throw new Error('Lecture not found');
    }
    if (lecture.ownerId !== ownerId) {
      throw new Error('Access denied');
    }
    await this.prisma.lecture.delete({ where: { id } });
  }
}

export class ProcessingJobsRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async create(input: Omit<ProcessingJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProcessingJob> {
    const now = new Date().toISOString();
    const job = await this.prisma.processingJob.create({
      data: {
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return this.toStoredJob(job);
  }

  async findById(id: string): Promise<ProcessingJob | undefined> {
    const job = await this.prisma.processingJob.findUnique({
      where: { id },
    });
    if (job) {
      return this.toStoredJob(job);
    }
    return undefined;
  }

  async list(): Promise<ProcessingJob[]> {
    return this.prisma.processingJob.findMany().then(jobs => jobs.map(this.toStoredJob));
  }

  async save(job: ProcessingJob): Promise<ProcessingJob> {
    const existing = await this.prisma.processingJob.findUnique({ where: { id: job.id } });
    if (existing) {
      return this.prisma.processingJob.update({
        where: { id: job.id },
        data: {
          ...job,
          updatedAt: new Date().toISOString(),
        },
      });
    } else {
      return this.prisma.processingJob.create({
        data: {
          ...job,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }
  }
}

export class UsageRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async create(input: Omit<UsageEvent, 'id' | 'recordedAt'>): Promise<UsageEvent> {
    const event = await this.prisma.usageEvent.create({
      data: {
        ...input,
        recordedAt: new Date().toISOString(),
      },
    });
    return this.toStoredEvent(event);
  }

  async list(): Promise<UsageEvent[]> {
    return this.prisma.usageEvent.findMany().then(events => events.map(this.toStoredEvent));
  }
}

export class AuditRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async create(input: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog> {
    const log = await this.prisma.auditLog.create({
      data: {
        ...input,
        createdAt: new Date().toISOString(),
      },
    });
    return this.toStoredLog(log);
  }

  async list(): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany().then(logs => logs.map(this.toStoredLog));
  }
}

export class ConsentRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async create(input: Omit<StoredConsent, 'id' | 'createdAt'>): Promise<StoredConsent> {
    const record = await this.prisma.consentRecord.create({
      data: {
        ...input,
        createdAt: new Date().toISOString(),
      },
    });
    return this.toStoredConsent(record);
  }

  async listByUser(userId: string): Promise<StoredConsent[]> {
    return this.prisma.consentRecord.findMany({
      where: { userId },
    }).then(records => records.map(this.toStoredConsent));
  }
}

function toPublicUser(user: any): StoredUser {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    fullName: user.fullName,
    status: user.status,
    roles: user.roles,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function toPublicUserProfile(profile: any): UserProfile {
  return {
    id: profile.id,
    userId: profile.userId,
    role: profile.role,
    institution: profile.institution,
    degree: profile.degree,
    semester: profile.semester,
    preferredLanguage: profile.preferredLanguage,
    studyGoals: profile.studyGoals,
    consentAcknowledged: profile.consentAcknowledged,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function toPublicUserProfile(profile: any): UserProfile {
  return {
    id: profile.id,
    userId: profile.userId,
    role: profile.role,
    institution: profile.institution,
    degree: profile.degree,
    semester: profile.semester,
    preferredLanguage: profile.preferredLanguage,
    studyGoals: profile.studyGoals,
    consentAcknowledged: profile.consentAcknowledged,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function toPublicCourse(course: any): Course {
  return {
    id: course.id,
    ownerId: course.ownerId,
    title: course.title,
    description: course.description,
    color: course.color,
    nextExamDate: course.nextExamDate,
    lectureCount: course.lectureCount,
    weakTopics: course.weakTopics,
    progress: course.progress,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

function toStoredCourse(course: any): Course {
  return {
    id: course.id,
    ownerId: course.ownerId,
    title: course.title,
    description: course.description,
    color: course.color,
    nextExamDate: course.nextExamDate,
    lectureCount: course.lectureCount,
    weakTopics: course.weakTopics,
    progress: course.progress,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

function toStoredCourseWithOwner(course: any): StoredCourse {
  return {
    id: course.id,
    ownerId: course.ownerId,
    title: course.title,
    description: course.description,
    color: course.color,
    nextExamDate: course.nextExamDate,
    lectureCount: course.lectureCount,
    weakTopics: course.weakTopics,
    progress: course.progress,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

function toStoredLecture(course: any): StoredLecture {
  return {
    id: course.id,
    courseId: course.courseId,
    ownerId: course.ownerId,
    title: course.title,
    state: course.state,
    audioFileId: course.audioFileId,
    durationSeconds: course.durationSeconds,
    consentAcknowledged: course.consentAcknowledged,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

function toStoredCourse(course: any): Course {
  return {
    id: course.id,
    ownerId: course.ownerId,
    title: course.title,
    description: course.description,
    color: course.color,
    nextExamDate: course.nextExamDate,
    lectureCount: course.lectureCount,
    weakTopics: course.weakTopics,
    progress: course.progress,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

function toStoredCourseWithOwner(course: any): StoredCourse {
  return {
    id: course.id,
    ownerId: course.ownerId,
    title: course.title,
    description: course.description,
    color: course.color,
    nextExamDate: course.nextExamDate,
    lectureCount: course.lectureCount,
    weakTopics: course.weakTopics,
    progress: course.progress,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

function toStoredLecture(course: any): StoredLecture {
  return {
    id: course.id,
    courseId: course.courseId,
    ownerId: course.ownerId,
    title: course.title,
    state: course.state,
    audioFileId: course.audioFileId,
    durationSeconds: course.durationSeconds,
    consentAcknowledged: course.consentAcknowledged,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

function toStoredFlashcard(card: any): Flashcard {
  return {
    id: card.id,
    lectureId: card.lectureId,
    courseId: card.courseId,
    question: card.question,
    answer: card.answer,
  };
}

function toStoredDocument(document: any): Document {
  return {
    id: document.id,
    ownerId: document.ownerId,
    title: document.title,
    fileUrl: document.fileUrl,
    createdAt: document.createdAt,
    pages: document.pages,
    embeddings: document.embeddings,
  };
}

function toStoredDocumentPage(page: any): DocumentPage {
  return {
    id: page.id,
    documentId: page.documentId,
    pageNumber: page.pageNumber,
    text: page.text,
  };
}

function toStoredEmbedding(embedding: any): Embedding {
  return {
    id: embedding.id,
    documentId: embedding.documentId,
    segmentId: embedding.segmentId,
    vector: embedding.vector,
    model: embedding.model,
  };
}

function toStoredChatThread(chatThread: any): ChatThread {
  return {
    id: chatThread.id,
    ownerId: chatThread.ownerId,
    courseId: chatThread.courseId,
    title: chatThread.title,
    createdAt: chatThread.createdAt,
    messages: chatThread.messages,
  };
}

function toStoredChatMessage(message: any): ChatMessage {
  return {
    id: message.id,
    threadId: message.threadId,
    role: message.role,
    content: message.content,
    citations: message.citations,
    createdAt: message.createdAt,
  };
}

function toStoredProcessingJob(job: any): ProcessingJob {
  return {
    id: job.id,
    jobType: job.jobType,
    status: job.status,
    retryCount: job.retryCount,
    maxRetries: job.maxRetries,
    errorCode: job.errorCode,
    safeErrorMessage: job.safeErrorMessage,
    diagnosticReference: job.diagnosticReference,
    payload: job.payload,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

function toStoredUsageEvent(event: any): UsageEvent {
  return {
    id: event.id,
    userId: event.userId,
    kind: event.kind,
    amount: event.amount,
    recordedAt: event.recordedAt,
  };
}

function toStoredAuditLog(log: any): AuditLog {
  return {
    id: log.id,
    actorId: log.actorId,
    actorType: log.actorType,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    requestId: log.requestId,
    createdAt: log.createdAt,
    actor: log.actor,
  };
}

function toStoredConsent(consent: any): StoredConsent {
  return {
    id: consent.id,
    userId: consent.userId,
    purpose: consent.purpose,
    acknowledged: consent.acknowledged,
    version: consent.version,
    createdAt: consent.createdAt,
  };
}

function toStoredUpload(upload: any): StoredUpload {
  return {
    id: upload.id,
    ownerId: upload.ownerId,
    purpose: upload.purpose,
    fileName: upload.fileName,
    mimeType: upload.mimeType,
    fileSize: upload.fileSize,
    status: upload.status,
    uploadUrl: upload.uploadUrl,
    createdAt: upload.createdAt,
  };
}

function toStoredConsent(consent: any): StoredConsent {
  return {
    id: consent.id,
    userId: consent.userId,
    purpose: consent.purpose,
    acknowledged: consent.acknowledged,
    version: consent.version,
    createdAt: consent.createdAt,
  };
}

function toStoredDataExportRequest(exportRequest: any): DataExportRequest {
  return {
    id: exportRequest.id,
    userId: exportRequest.userId,
    status: exportRequest.status,
    createdAt: exportRequest.createdAt,
    completedAt: exportRequest.completedAt,
  };
}

function toStoredDeletionRequest(deletionRequest: any): DeletionRequest {
  return {
    id: deletionRequest.id,
    userId: deletionRequest.userId,
    status: deletionRequest.status,
    createdAt: deletionRequest.createdAt,
    completedAt: deletionRequest.completedAt,
  };
}

function toStoredUpload(upload: any): StoredUpload {
  return {
    id: upload.id,
    ownerId: upload.ownerId,
    purpose: upload.purpose,
    fileName: upload.fileName,
    mimeType: upload.mimeType,
    fileSize: upload.fileSize,
    status: upload.status,
    uploadUrl: upload.uploadUrl,
    createdAt: upload.createdAt,
  };
}

function toStoredConsent(consent: any): StoredConsent {
  return {
    id: consent.id,
    userId: consent.userId,
    purpose: consent.purpose,
    acknowledged: consent.acknowledged,
    version: consent.version,
    createdAt: consent.createdAt,
  };
}

function toStoredDataExportRequest(exportRequest: any): DataExportRequest {
  return {
    id: exportRequest.id,
    userId: exportRequest.userId,
    status: exportRequest.status,
    createdAt: exportRequest.createdAt,
    completedAt: exportRequest.completedAt,
  };
}

function toStoredDeletionRequest(deletionRequest: any): DeletionRequest {
  return {
    id: deletionRequest.id,
    userId: deletionRequest.userId,
    status: deletionRequest.status,
    createdAt: deletionRequest.createdAt,
    completedAt: deletionRequest.completedAt,
  };
}

function toStoredUpload(upload: any): StoredUpload {
  return {
    id: upload.id,
    ownerId: upload.ownerId,
    purpose: upload.purpose,
    fileName: upload.fileName,
    mimeType: upload.mimeType,
    fileSize: upload.fileSize,
    status: upload.status,
    uploadUrl: upload.uploadUrl,
    createdAt: upload.createdAt,
  };
}

function toStoredConsent(consent: any): StoredConsent {
  return {
    id: consent.id,
    userId: consent.userId,
    purpose: consent.purpose,
    acknowledged: consent.acknowledged,
    version: consent.version,
    createdAt: consent.createdAt,
  };
}

function toStoredDataExportRequest(exportRequest: any): DataExportRequest {
  return {
    id: exportRequest.id,
    userId: exportRequest.userId,
    status: exportRequest.status,
    createdAt: exportRequest.createdAt,
    completedAt: exportRequest.completedAt,
  };
}

function toStoredDeletionRequest(deletionRequest: any): DeletionRequest {
  return {
    id: deletionRequest.id,
    userId: deletionRequest.userId,
    status: deletionRequest.status,
    createdAt: deletionRequest.createdAt,
    completedAt: deletionRequest.completedAt,
  };
}

function toStoredUpload(upload: any): StoredUpload {
  return {
    id: upload.id,
    ownerId: upload.ownerId,
    purpose: upload.purpose,
    fileName: upload.fileName,
    mimeType: upload.mimeType,
    fileSize: upload.fileSize,
    status: upload.status,
    uploadUrl: upload.uploadUrl,
    createdAt: upload.createdAt,
  };
}

function toStoredConsent(consent: any): StoredConsent {
  return {
    id: consent.id,
    userId: consent.userId,
    purpose: consent.purpose,
    acknowledged: consent.acknowledged,
    version: consent.version,
    createdAt: consent.createdAt,
  };
}

function toStoredDataExportRequest(exportRequest: any): DataExportRequest {
  return {
    id: exportRequest.id,
    userId: exportRequest.userId,
    status: exportRequest.status,
    createdAt: exportRequest.createdAt,
    completedAt: exportRequest.completedAt,
  };
}

function toStoredDeletionRequest(deletionRequest: any): DeletionRequest {
  return {
    id: deletionRequest.id,
    userId: deletionRequest.userId,
    status: deletionRequest.status,
    createdAt: deletionRequest.createdAt,
    completedAt: deletionRequest.completedAt,
  };
}

function toStoredUpload(upload: any): StoredUpload {
  return {
    id: upload.id,
    ownerId: upload.ownerId,
    purpose: upload.purpose,
    fileName: upload.fileName,
    mimeType: upload.mimeType,
    fileSize: upload.fileSize,
    status: upload.status,
    uploadUrl: upload.uploadUrl,
    createdAt: upload.createdAt,
  };
}

function toStoredConsent(consent: any): StoredConsent {
  return {
    id: consent.id,
    userId: consent.userId,
    purpose: consent.purpose,
    acknowledged: consent.acknowledged,
    version: consent.version,
    createdAt: consent.createdAt,
  };
}

function toStoredDataExportRequest(exportRequest: any): DataExportRequest {
  return {
    id: exportRequest.id,
    userId: exportRequest.userId,
    status: exportRequest.status,
    createdAt: exportRequest.createdAt,
    completedAt: exportRequest.completedAt,
  };
}

function toStoredDeletionRequest(deletionRequest: any): DeletionRequest {
  return {
    id: deletionRequest.id,
    userId: deletionRequest.userId,
    status: deletionRequest.status,
    createdAt: deletionRequest.createdAt,
    completedAt: deletionRequest.completedAt,
  };
}