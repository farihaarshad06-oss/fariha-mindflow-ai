import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { AdminUsageService } from './usage.service';

@Controller('usage')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsageController {
  constructor(private readonly usageService: AdminUsageService) {}

  @Roles('PLATFORM_ADMIN', 'SUPPORT')
  @Get()
  totals() {
    return this.usageService.totals();
  }

  @Roles('PLATFORM_ADMIN', 'SUPPORT')
  @Get('events')
  events() {
    return this.usageService.events();
  }
}
