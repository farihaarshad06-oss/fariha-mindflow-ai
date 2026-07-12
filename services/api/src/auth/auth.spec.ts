import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from '../testing/create-app';

describe('Global validation and error format', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a normalized validation error for invalid login', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: '' })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.statusCode).toBe(400);
    expect(typeof response.body.message).toBe('string');
    expect(response.body.requestId).toBeDefined();
    expect(response.body.path).toBe('/api/auth/login');
    expect(Array.isArray(response.body.details)).toBe(true);
  });
});
