import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './courses.dto';

@Controller('courses')
@UseGuards(JwtAuthGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.listForOwner(user.userId);
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.getForOwner(id, user.userId, user.roles);
  }

  @Post()
  create(@Body() dto: CreateCourseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.create(dto, user.userId, user.roles);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.remove(id, user.userId, user.roles);
  }
}
