import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators';
import { env } from '../core/env';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  get(): ReturnType<HealthService['get']> {
    return this.healthService.get();
  }
}
