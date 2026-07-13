import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EnvironmentValidationService {
  constructor(
    @Inject('ENV') private readonly config: ConfigService,
  ) {}

  validate(): void {
    // Check for required production environment variables
    const requiredVars = [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'DATABASE_URL',
      'CORS_ORIGINS',
      'NODE_ENV',
    ];
    
    requiredVars.forEach(varName => {
      if (!this.config.get<string>(varName)) {
        throw new Error(`Missing required environment variable: ${varName}`);
      }
    }
    
    // Check that we're not running in production with unsafe defaults
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const hasProductionVars = this.config.get<string>('JWT_ACCESS_SECRET') !== 'dev-secret-key-123';
    
    if (isProduction && !hasProductionVars) {
      throw new Error('Production environment requires valid configuration');
    }
    
    // Check that development mode is clearly identified
    const isDev = !isProduction;
    if (isDev) {
      // Ensure development mode is clearly indicated
      const devMode = this.config.get<string>('NODE_ENV') === 'development';
      if (!devMode) {
        throw new Error('Development environment not properly configured');
      }
    }
  }