import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { ApiErrorCode, ApiErrorBody } from '@mindflow/types';

interface ValidationErrorDetail {
  field: string;
  message: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request as Request & { requestId?: string }).requestId ?? randomUUID();
    const path = request.url;
    const timestamp = new Date().toISOString();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ApiErrorCode = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred. Please try again later.';
    let details: ValidationErrorDetail[] | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const record = res as Record<string, unknown>;
        message =
          typeof record.message === 'string'
            ? record.message
            : Array.isArray(record.message)
              ? (record.message as string[]).join(', ')
              : exception.message;
        if (statusCode === HttpStatus.BAD_REQUEST) {
          code = 'VALIDATION_ERROR';
          details = this.normalizeValidation(record.message);
        } else if (statusCode === HttpStatus.UNAUTHORIZED) {
          code = 'UNAUTHORIZED';
        } else if (statusCode === HttpStatus.FORBIDDEN) {
          code = 'FORBIDDEN';
        } else if (statusCode === HttpStatus.NOT_FOUND) {
          code = 'NOT_FOUND';
          message = 'The requested resource was not found.';
        } else if (statusCode === HttpStatus.CONFLICT) {
          code = 'CONFLICT';
        }
      }
    }

    if (statusCode >= 500) {
      this.logger.error(`Unhandled error on ${path}`, {
        requestId,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    }

    const body: ApiErrorBody = {
      statusCode,
      code,
      message,
      requestId,
      timestamp,
      path,
      ...(details ? { details } : {}),
    };
    response.status(statusCode).json(body);
  }

  private normalizeValidation(message: unknown): ValidationErrorDetail[] | undefined {
    if (!Array.isArray(message)) return undefined;
    return message
      .map((item) => {
        if (typeof item === 'string') return { field: 'body', message: item };
        if (item && typeof item === 'object' && 'property' in item && 'constraints' in item) {
          const constraints = (item as { constraints?: Record<string, string> }).constraints ?? {};
          return {
            field: String((item as { property: string }).property),
            message: Object.values(constraints).join(', '),
          };
        }
        return undefined;
      })
      .filter((item): item is ValidationErrorDetail => item !== undefined);
  }
}
