export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'FILE_REJECTED';

export interface ApiErrorBody {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  requestId: string;
  timestamp: string;
  path: string;
  details?: unknown;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  timestamp: string;
  version: string;
}
