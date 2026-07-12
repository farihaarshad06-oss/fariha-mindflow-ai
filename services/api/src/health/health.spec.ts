import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from '../testing/create-app';

describe('HealthController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns ok health status', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('mindflow-api');
    expect(typeof response.body.timestamp).toBe('string');
    expect(response.body.version).toBeDefined();
  });

  it('includes a request id header', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.headers['x-request-id']).toBeDefined();
    expect(typeof response.headers['x-request-id']).toBe('string');
  });
});
