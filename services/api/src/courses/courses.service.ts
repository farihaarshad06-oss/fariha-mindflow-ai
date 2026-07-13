import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Course, Role } from '@mindflow/types';
import { CoursesRepository } from '../core/repositories';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { RoleGuard } from '../common/guards/role.guard';

@Injectable()
export class CoursesService {
  constructor(private readonly courses: CoursesRepository) {}

  listForOwner(ownerId: string): Course[] {
    return this.courses.listByOwner(ownerId);
  }

  getForOwner(id: string, ownerId: string, userRoles: Role[]): Course {
    const course = this.courses.findById(id);
    if (!course) throw new NotFoundException('Course not found.');
    if (course.ownerId !== ownerId) throw new ForbiddenException('Access denied.');
    
    // Check role-based permissions
    const hasPermission = this.hasPermission(userRoles, course, 'COURSE_MANAGE');
    if (!hasPermission) throw new ForbiddenException('Access denied.');
    
    return course;
  }

  create(input: { title: string; description?: string; color?: string; nextExamDate?: string }, ownerId: string, userRoles: Role[]): Course {
    return this.courses.create({ ...input, ownerId });
  }

  remove(id: string, ownerId: string, userRoles: Role[]): { id: string } {
    const course = this.courses.findById(id);
    if (!course) throw new NotFoundException('Course not found.');
    if (course.ownerId !== ownerId) throw new ForbiddenException('Access denied.');
    if (!this.hasPermission(userRoles, course, 'COURSE_DELETE')) {
      throw new ForbiddenException('Insufficient permissions');
    }
    this.courses.remove(id);
    return { id };
  }

  private hasPermission(roles: Role[], course: Course, permission: string): boolean {
    // Simple implementation - in a real system, this would be more complex
    // For now, we'll assume that STUDENT, PROFESSIONAL, UNIVERSITY_ADMIN, PLATFORM_ADMIN can manage courses
    const allowedRoles = ['STUDENT', 'PROFESSIONAL', 'UNIVERSITY_ADMIN', 'PLATFORM_ADMIN'];
    return allowedRoles.includes(roles[0]) || 
           (course.ownerId === ownerId && allowedRoles.includes(roles[0]));
  }
}