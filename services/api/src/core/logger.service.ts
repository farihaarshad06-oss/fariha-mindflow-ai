import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';
import { env } from './env';

interface LogContext {
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

@Injectable({ scope: Scope.DEFAULT })
export class LoggerService implements NestLoggerService {
  private readonly service = 'mindflow-api';

  private write(level: string, message: string, context?: LogContext): void {
    const entry = {
      level,
      service: this.service,
      message,
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      ...(context ?? {}),
    };
    const line = JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }

  log(message: string, context?: LogContext): void {
    this.write('info', message, context);
  }

  error(message: string, trace?: string, context?: LogContext): void {
    this.write('error', message, { ...(context ?? {}), trace: this.sanitize(trace) });
  }

  warn(message: string, context?: LogContext): void {
    this.write('warn', message, context);
  }

  debug(message: string, context?: LogContext): void {
    if (env.LOG_LEVEL === 'debug') this.write('debug', message, context);
  }

  private sanitize(value?: string): string | undefined {
    if (!value) return undefined;
    return value.replace(/(password|token|secret)=[^&\s]+/gi, '$1=***');
  }
}
