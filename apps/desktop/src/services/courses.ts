/**
 * CourseService & LectureService — CRUD for courses and lectures backed by SQLite.
 */

import { getPrisma } from './database';
import log from 'electron-log/main';
import type { Course, Lecture } from '@prisma/client';

export const CourseService = {
  async list(): Promise<Course[]> {
    return getPrisma().course.findMany({ orderBy: { createdAt: 'desc' } });
  },

  async get(id: string): Promise<Course | null> {
    return getPrisma().course.findUnique({ where: { id } });
  },

  async create(data: { title: string; description?: string; color?: string; nextExamDate?: string }): Promise<Course> {
    const course = await getPrisma().course.create({
      data: {
        title: data.title,
        description: data.description,
        color: data.color,
        nextExamDate: data.nextExamDate ? new Date(data.nextExamDate) : undefined,
      },
    });
    log.info('[courses] Created:', course.id, course.title);
    return course;
  },

  async update(id: string, data: Partial<{ title: string; description: string; color: string; nextExamDate: string; progress: number; weakTopics: string[] }>): Promise<Course> {
    return getPrisma().course.update({
      where: { id },
      data: {
        ...data,
        nextExamDate: data.nextExamDate ? new Date(data.nextExamDate) : undefined,
        weakTopics: data.weakTopics ? JSON.stringify(data.weakTopics) : undefined,
      },
    });
  },

  async delete(id: string): Promise<void> {
    await getPrisma().course.delete({ where: { id } });
    log.info('[courses] Deleted:', id);
  },

  async getLectureCount(courseId: string): Promise<number> {
    return getPrisma().lecture.count({ where: { courseId } });
  },
};

export const LectureService = {
  async list(courseId?: string): Promise<Lecture[]> {
    return getPrisma().lecture.findMany({
      where: courseId ? { courseId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  },

  async get(id: string): Promise<Lecture | null> {
    return getPrisma().lecture.findUnique({ where: { id } });
  },

  async create(data: { courseId?: string; title: string; language?: string }): Promise<Lecture> {
    const lecture = await getPrisma().lecture.create({
      data: {
        courseId: data.courseId,
        title: data.title,
        language: data.language ?? 'en',
        state: 'PENDING',
      },
    });
    log.info('[lectures] Created:', lecture.id, lecture.title);
    return lecture;
  },

  async update(id: string, data: Partial<{ title: string; state: string; durationSeconds: number; audioPath: string; language: string }>): Promise<Lecture> {
    return getPrisma().lecture.update({ where: { id }, data });
  },

  async delete(id: string): Promise<void> {
    await getPrisma().lecture.delete({ where: { id } });
    log.info('[lectures] Deleted:', id);
  },
};
