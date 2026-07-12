import { randomUUID } from 'node:crypto';
import type {
  User,
  Course,
  Lecture,
  ProcessingJob,
  UsageEvent,
  AuditLog,
  ConsentRecord,
  UserProfile,
  Role,
} from '@mindflow/types';

export interface StoredUser extends User {
  passwordHash: string;
}

export interface StoredLecture extends Lecture {
  consentAcknowledged: boolean;
  transcript?: string;
}

export class UsersRepository {
  private readonly users = new Map<string, StoredUser>();
  private readonly profiles = new Map<string, UserProfile>();

  create(input: Omit<StoredUser, 'id' | 'createdAt' | 'updatedAt' | 'status'>): StoredUser {
    const now = new Date().toISOString();
    const user: StoredUser = {
      id: randomUUID(),
      status: 'PENDING_VERIFICATION',
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    this.users.set(user.id, user);
    return user;
  }

  findByEmail(email: string): StoredUser | undefined {
    const normalized = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalized) return user;
    }
    return undefined;
  }

  findById(id: string): StoredUser | undefined {
    return this.users.get(id);
  }

  save(user: StoredUser): StoredUser {
    this.users.set(user.id, user);
    return user;
  }

  list(): StoredUser[] {
    return [...this.users.values()];
  }

  createProfile(input: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): UserProfile {
    const now = new Date().toISOString();
    const profile: UserProfile = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    this.profiles.set(profile.id, profile);
    return profile;
  }
}

export class CoursesRepository {
  private readonly courses = new Map<string, Course>();

  create(input: Omit<Course, 'id' | 'createdAt' | 'updatedAt' | 'lectureCount' | 'weakTopics' | 'progress'>): Course {
    const now = new Date().toISOString();
    const course: Course = {
      id: randomUUID(),
      lectureCount: 0,
      weakTopics: [],
      progress: 0,
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    this.courses.set(course.id, course);
    return course;
  }

  findById(id: string): Course | undefined {
    return this.courses.get(id);
  }

  listByOwner(ownerId: string): Course[] {
    return [...this.courses.values()].filter((course) => course.ownerId === ownerId);
  }

  list(): Course[] {
    return [...this.courses.values()];
  }

  save(course: Course): Course {
    this.courses.set(course.id, course);
    return course;
  }

  remove(id: string): void {
    this.courses.delete(id);
  }
}

export class LecturesRepository {
  private readonly lectures = new Map<string, StoredLecture>();

  create(input: Omit<StoredLecture, 'id' | 'createdAt' | 'updatedAt'>): StoredLecture {
    const now = new Date().toISOString();
    const lecture: StoredLecture = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    this.lectures.set(lecture.id, lecture);
    return lecture;
  }

  findById(id: string): StoredLecture | undefined {
    return this.lectures.get(id);
  }

  listByOwner(ownerId: string): StoredLecture[] {
    return [...this.lectures.values()].filter((lecture) => lecture.ownerId === ownerId);
  }

  list(): StoredLecture[] {
    return [...this.lectures.values()];
  }

  save(lecture: StoredLecture): StoredLecture {
    this.lectures.set(lecture.id, lecture);
    return lecture;
  }

  remove(id: string): void {
    this.lectures.delete(id);
  }
}

export class ProcessingJobsRepository {
  private readonly jobs = new Map<string, ProcessingJob>();

  create(input: Omit<ProcessingJob, 'id' | 'createdAt' | 'updatedAt'>): ProcessingJob {
    const now = new Date().toISOString();
    const job: ProcessingJob = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  findById(id: string): ProcessingJob | undefined {
    return this.jobs.get(id);
  }

  list(): ProcessingJob[] {
    return [...this.jobs.values()];
  }

  save(job: ProcessingJob): ProcessingJob {
    this.jobs.set(job.id, job);
    return job;
  }
}

export class UsageRepository {
  private readonly events = new Map<string, UsageEvent>();

  create(input: Omit<UsageEvent, 'id' | 'recordedAt'>): UsageEvent {
    const event: UsageEvent = {
      id: randomUUID(),
      recordedAt: new Date().toISOString(),
      ...input,
    };
    this.events.set(event.id, event);
    return event;
  }

  list(): UsageEvent[] {
    return [...this.events.values()];
  }
}

export class AuditRepository {
  private readonly logs = new Map<string, AuditLog>();

  create(input: Omit<AuditLog, 'id' | 'createdAt'>): AuditLog {
    const log: AuditLog = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...input,
    };
    this.logs.set(log.id, log);
    return log;
  }

  list(): AuditLog[] {
    return [...this.logs.values()];
  }
}

export interface StoredUpload {
  id: string;
  ownerId: string;
  purpose: 'LECTURE_AUDIO' | 'COURSE_DOCUMENT';
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: 'REQUESTED' | 'COMPLETED' | 'DELETED';
  uploadUrl?: string;
  createdAt: string;
}

export class UploadRepository {
  private readonly uploads = new Map<string, StoredUpload>();

  create(input: Omit<StoredUpload, 'id' | 'createdAt' | 'status'>): StoredUpload {
    const upload: StoredUpload = {
      id: randomUUID(),
      status: 'REQUESTED',
      createdAt: new Date().toISOString(),
      ...input,
    };
    this.uploads.set(upload.id, upload);
    return upload;
  }

  findById(id: string): StoredUpload | undefined {
    return this.uploads.get(id);
  }

  save(upload: StoredUpload): StoredUpload {
    this.uploads.set(upload.id, upload);
    return upload;
  }
}

export interface StoredConsent extends ConsentRecord {}
export class ConsentRepository {
  private readonly records = new Map<string, StoredConsent>();
  create(input: Omit<StoredConsent, 'id' | 'createdAt'>): StoredConsent {
    const record: StoredConsent = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...input,
    };
    this.records.set(record.id, record);
    return record;
  }
  listByUser(userId: string): StoredConsent[] {
    return [...this.records.values()].filter((r) => r.userId === userId);
  }
}

export type { Role };
