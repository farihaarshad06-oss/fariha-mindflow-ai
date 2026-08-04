import { Injectable } from '@nestjs/common';
import { env } from './env';

@Injectable()
export class EnvironmentValidationService {
  validate(): void {
    if (env.NODE_ENV !== 'production') {
      return;
    }

    const requiredValues: Array<[string, string | undefined]> = [
      ['JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET],
      ['JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET],
      ['DATABASE_URL', env.DATABASE_URL],
    ];

    const missing = requiredValues.filter(([, value]) => !value).map(([name]) => name);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
}
