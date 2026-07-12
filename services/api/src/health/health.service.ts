import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@mindflow/types';
import { API_VERSION } from '@mindflow/config';

@Injectable()
export class HealthService {
  get(): HealthResponse {
    return {
      status: 'ok',
      service: 'mindflow-api',
      timestamp: new Date().toISOString(),
      version: API_VERSION,
    };
  }
}
