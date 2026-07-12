import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { LecturesService } from './lectures.service';
import { CreateLectureDto } from './lectures.dto';

@Controller('lectures')
@UseGuards(JwtAuthGuard)
export class LecturesController {
  constructor(private readonly lecturesService: LecturesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.lecturesService.listForOwner(user.userId);
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.lecturesService.getForOwner(id, user.userId);
  }

  @Post()
  create(@Body() dto: CreateLectureDto, @CurrentUser() user: AuthenticatedUser) {
    return this.lecturesService.create(dto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.lecturesService.remove(id, user.userId);
  }
}
