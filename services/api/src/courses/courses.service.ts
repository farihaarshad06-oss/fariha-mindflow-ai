import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Course, Role } from '@mindflow/types';
import { CoursesRepository } from '../core/repositories';

@Injectable()
export class CoursesService {
  constructor(private readonly courses: CoursesRepository) {}

  async listForOwner(ownerId: string): Promise<Course[]> {
    return this.courses.listByOwner(ownerId);
  }

  async getForOwner(id: string, ownerId: string, userRoles: Role[]): Promise<Course> {
    const course = await this.courses.findById(id);
    if (!course) throw new NotFoundException('Course not found.');
    if (course.ownerId !== ownerId) throw new ForbiddenException('Access denied.');
    if (!this.hasPermission(userRoles)) throw new ForbiddenException('Access denied.');
    return course;
  }

  async create(input: { title: string; description?: string; color?: string; nextExamDate?: string }, ownerId: string, userRoles: Role[]): Promise<Course> {
    if (!this.hasPermission(userRoles)) throw new ForbiddenException('Insufficient permissions');
    return this.courses.create({ ...input, ownerId });
  }

  async remove(id: string, ownerId: string, userRoles: Role[]): Promise<{ id: string }> {
    const course = await this.courses.findById(id);
    if (!course) throw new NotFoundException('Course not found.');
    if (course.ownerId !== ownerId) throw new ForbiddenException('Access denied.');
    if (!this.hasPermission(userRoles)) throw new ForbiddenException('Insufficient permissions');
    return this.courses.remove(id, ownerId);
  }

  private hasPermission(roles: Role[]): boolean {
    const allowedRoles: Role[] = ['STUDENT', 'TEACHER', 'TUTOR', 'PARENT', 'ADMIN', 'SUPPORT', 'CONTENT_REVIEWER'];
    return roles.some((role) => allowedRoles.includes(role));
  }
}
