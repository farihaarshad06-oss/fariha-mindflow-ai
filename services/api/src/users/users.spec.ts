import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from '../testing/create-app';
import { JwtService } from '../core/jwt.service';

describe('RolesGuard', () => {
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(async () => {
    app = await createTestApp();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated access to admin users list with 401', async () => {
    await request(app.getHttpServer()).get('/api/users').expect(401);
  });

  it('rejects authenticated non-admin access with 403', async () => {
    const token = jwt.signAccess({ sub: 'student-1', roles: ['STUDENT'] });
    const response = await request(app.getHttpServer())
      .get('/api/users')
      .set('authorization', `Bearer ${token}`)
      .expect(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('accepts a platform admin token', async () => {
    const token = jwt.signAccess({ sub: 'admin-1', roles: ['PLATFORM_ADMIN'] });
    const response = await request(app.getHttpServer())
      .get('/api/users')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});
