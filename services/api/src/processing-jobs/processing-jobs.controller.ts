import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { ProcessingJobsService } from './processing-jobs.service';

@Controller('processing-jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProcessingJobsController {
  constructor(private readonly processingJobsService: ProcessingJobsService) {}

  @Roles('PLATFORM_ADMIN', 'SUPPORT')
  @Get()
  list() {
    return this.processingJobsService.list();
  }

  @Roles('PLATFORM_ADMIN', 'SUPPORT')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.processingJobsService.getById(id);
  }
}
