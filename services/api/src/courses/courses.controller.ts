import { Controller, Body, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './courses.dto';
import { RoleGuard } from '../common/guards/role.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { Role } from '../../types';

@Controller('courses')
@UseGuards(JwtAuthGuard, RoleGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.listForOwner(user.userId);
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.getForOwner(id, user.userId);
  }

  @Post()
  @RoleGuard('UNIVERSITY_ADMIN', 'PROFESSIONAL', 'CONTENT_MODERATOR', 'PLATFORM_ADMIN')
  create(@Body() dto: CreateCourseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.create(dto, user.userId, user.roles);
  }

  @Delete(':id')
  @RoleGuard('UNIVERSITY_ADMIN', 'PROFESSIONAL', 'CONTENT_MODERATOR', 'PLATFORM_ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.remove(id, user.userId, user.roles);
  }
}