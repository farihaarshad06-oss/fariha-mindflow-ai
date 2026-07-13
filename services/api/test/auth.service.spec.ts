import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '../core/jwt.service';
import { UsersRepository } from '../core/repositories';
import { PasswordService } from '../core/password.service';
import { AuditService } from '../core/audit.service';
import { INestApplication } from '@nestjs/common';
import { INestApplicationContext } from '@nestjs/common/testing';
import { INestApplicationBuilder } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        UsersRepository,
        PasswordService,
        AuditService,
      ],
    }).compile();

    service = moduleFixture.get<AuthService>(AuthService);
    app = moduleFixture.createNestApplication<INestApplication>(() => ({}));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  }

  describe('register', () => {
    it('should register a new user', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
        role: 'STUDENT',
      };
      
      const result = await service.register(dto);
      expect(result).toBeDefined();
      expect(result.user).toHaveProperty('id');
      expect(result.user.email).toBe(dto.email);
      expect(result.user.roles).toContain('STUDENT');
      expect(result.user.status).toBe('PENDING_VERIFICATION');
    }
  })

  it('should throw error when email is missing', async () => {
    const dto = {
      password: 'password123',
      fullName: 'Test User',
    };
    
    await expect(service.register(dto)).rejects.toThrow(BadRequestException);
  }

  it('should throw error when password is missing', async () => {
    const dto = {
      email: 'test@example.com',
      fullName: 'Test User',
    };
    
    await expect(service.register(dto)).rejects.toThrow(BadRequestException);
  }