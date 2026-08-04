import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { helmet } from 'helmet';
import { compression } from 'compression';
import cors from 'cors';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { API_PREFIX, env } from './core/env';
import { LoggerService } from './core/logger.service';
import { LoggerService } from './core/logger.service';
import { EnvironmentValidationService } from './core/env-validation.service';

async function bootstrap(): Promise<void> {
  const logger = new LoggerService();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(logger);
  
  // Validate environment configuration
  const envValidator = new EnvironmentValidationService();
  envValidator.validate();
  
  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  
  app.use(helmet());
  app.use(compression());
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(new RequestIdMiddleware().use as (req: Request, res: Response, next: NextFunction) => void);
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      errorHttpStatusCode: 400,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  
  // Enable health checks
  app.enableShutdownHooks();
  
  await app.listen(env.API_PORT, '0.0.0.0');
  logger.log(`API listening on http://0.0.0.0:${env.API_PORT}/${API_PREFIX}`, {
    environment: env.NODE_ENV,
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start API', error);
  process.exit(1);
});