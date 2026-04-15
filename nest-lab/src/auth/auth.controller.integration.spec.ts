import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtUser } from './interfaces/jwt-user.interface';
import { Role } from '@prisma/client';
import { ExecutionContext } from '@nestjs/common';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  getMe: jest.fn(),
  updateMe: jest.fn(),
};

const mockUser: JwtUser = { id: 1, username: 'john_doe', role: Role.USER };

const mockSafeUser = {
  id: 1,
  username: 'john_doe',
  email: 'john@example.com',
  name: 'John Doe',
  role: 'USER',
};

// Guard that always passes and attaches mockUser to the request
const mockJwtAuthGuard = {
  canActivate: (ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    req.user = mockUser;
    return true;
  },
};

// Guard that simulates a missing/invalid token
const rejectJwtAuthGuard = {
  canActivate: () => {
    throw new UnauthorizedException();
  },
};

describe('AuthController (Integration)', () => {
  let app: INestApplication<App>;
  let unauthApp: INestApplication<App>;

  beforeAll(async () => {
    // Authenticated app — JwtAuthGuard always passes
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    // Unauthenticated app — JwtAuthGuard always rejects
    const unauthModule: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(rejectJwtAuthGuard)
      .compile();

    unauthApp = unauthModule.createNestApplication();
    unauthApp.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await unauthApp.init();
  });

  afterAll(async () => {
    await app.close();
    await unauthApp.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── POST /auth/register ──────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('should return 201 on successful registration', async () => {
      // Arrange
      mockAuthService.register.mockResolvedValue({
        message: 'User registered successfully',
        user: mockSafeUser,
      });

      // Act & Assert
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username: 'john_doe',
          email: 'john@example.com',
          name: 'John Doe',
          password: 'password123',
        })
        .expect(201);

      expect(res.body.message).toBe('User registered successfully');
    });

    it('should return 400 if required fields are missing', async () => {
      // Act & Assert — missing name and email
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'john_doe', password: 'password123' })
        .expect(400);
    });

    it('should return 400 if password is too short', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username: 'john_doe',
          email: 'john@example.com',
          name: 'John',
          password: 'short',
        })
        .expect(400);
    });

    it('should return 409 if username or email is already taken', async () => {
      // Arrange
      mockAuthService.register.mockRejectedValue(
        new ConflictException('Username or email is already in use'),
      );

      // Act & Assert
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username: 'john_doe',
          email: 'john@example.com',
          name: 'John Doe',
          password: 'password123',
        })
        .expect(409);
    });
  });

  // ─── POST /auth/login ─────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('should return 200 and an access token on success', async () => {
      // Arrange
      mockAuthService.login.mockResolvedValue({
        access_token: 'mock_token',
        user: mockSafeUser,
      });

      // Act & Assert
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: 'john_doe', password: 'password123' })
        .expect(200);

      expect(res.body.access_token).toBe('mock_token');
    });

    it('should return 400 if identifier or password is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: 'john_doe' }) // missing password
        .expect(400);
    });

    it('should return 401 on invalid credentials', async () => {
      // Arrange
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      // Act & Assert
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: 'john_doe', password: 'wrongpassword' })
        .expect(401);
    });
  });

  // ─── GET /auth/me ─────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('should return 200 with user profile when authenticated', async () => {
      // Arrange
      mockAuthService.getMe.mockResolvedValue(mockSafeUser);

      // Act & Assert
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .expect(200);

      expect(res.body.username).toBe('john_doe');
    });

    it('should return 401 when no token is provided', async () => {
      await request(unauthApp.getHttpServer()).get('/auth/me').expect(401);
    });
  });

  // ─── PATCH /auth/me ───────────────────────────────────────────────────────

  describe('PATCH /auth/me', () => {
    it('should return 200 with updated profile when authenticated', async () => {
      // Arrange
      const updatedUser = { ...mockSafeUser, name: 'John Updated' };
      mockAuthService.updateMe.mockResolvedValue(updatedUser);

      // Act & Assert
      const res = await request(app.getHttpServer())
        .patch('/auth/me')
        .send({ name: 'John Updated' })
        .expect(200);

      expect(res.body.name).toBe('John Updated');
    });

    it('should return 401 when no token is provided', async () => {
      await request(unauthApp.getHttpServer())
        .patch('/auth/me')
        .send({ name: 'John Updated' })
        .expect(401);
    });
  });
});
