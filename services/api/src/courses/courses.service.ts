import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Course } from '@mindflow/types';
import { CoursesRepository } from '../core/repositories';

@Injectable()
export class CoursesService {
  constructor(private readonly courses: CoursesRepository) {}

  listForOwner(ownerId: string): Course[] {
    return this.courses.listByOwner(ownerId);
  }

  getForOwner(id: string, ownerId: string): Course {
    const course = this.courses.findById(id);
    if (!course) throw new NotFoundException('Course not found.');
    if (course.ownerId !== ownerId) throw new ForbiddenException('Access denied.');
    return course;
  }

  create(input: { title: string; description?: string; color?: string; nextExamDate?: string }, ownerId: string): Course {
    return this.courses.create({ ...input, ownerId });
  }

  remove(id: string, ownerId: string): { id: string } {
    const course = this.courses.findById(id);
    if (!course) throw new NotFoundException('Course not found.');
    if (course.ownerId !== ownerId) throw new ForbiddenException('Access denied.');
    this.courses.remove(id);
    return { id };
  }
}
