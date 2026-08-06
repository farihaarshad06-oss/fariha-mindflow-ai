import { z } from 'zod';
import { ROLES } from '@mindflow/types';

const email = z.string().email().max(320);
const password = z.string().min(8).max(128);

export const registerSchema = z.object({
  email: email.toLowerCase(),
  password,
  fullName: z.string().min(2).max(120),
  role: z.enum(ROLES).default('STUDENT'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: email.toLowerCase(),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const onboardingSchema = z.object({
  role: z.string().min(1).max(120),
  institution: z.string().max(200).optional(),
  degree: z.string().max(200).optional(),
  semester: z.string().max(40).optional(),
  preferredLanguage: z.string().min(2).max(10).default('de'),
  studyGoals: z.array(z.string().min(1).max(200)).max(20).default([]),
  consentAcknowledged: z.literal(true, {
    errorMap: () => ({ message: 'Recording consent must be acknowledged' }),
  }),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const createCourseSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(2000).optional(),
  color: z.string().max(20).optional(),
  nextExamDate: z.string().datetime().optional(),
});
export type CreateCourseInput = z.infer<typeof createCourseSchema>;

export const createLectureSchema = z.object({
  courseId: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z.string().uuid().optional(),
  ),
  title: z.string().min(2).max(200),
  consentAcknowledged: z.boolean(),
});
export type CreateLectureInput = z.infer<typeof createLectureSchema>;

export const uploadRequestSchema = z.object({
  purpose: z.enum(['LECTURE_AUDIO', 'COURSE_DOCUMENT']),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  fileSize: z.number().int().positive().max(500 * 1024 * 1024),
  checksum: z.string().max(128).optional(),
});
export type UploadRequestInput = z.infer<typeof uploadRequestSchema>;

export const processingStatusSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD_LETTERED']),
});
export type ProcessingStatusInput = z.infer<typeof processingStatusSchema>;
