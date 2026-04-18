import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '@prisma/client';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { CacheInterceptor } from '@nestjs/cache-manager';

const mockRoomsService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  disable: jest.fn(),
  enable: jest.fn(),
  searchAvailable: jest.fn(),
};

const mockRoom = {
  id: 1,
  name: 'Deluxe Room 201',
  capacity: 2,
  pricePerNight: 2800,
  isActive: true,
};

const mockAdminUser: JwtUser = { id: 1, username: 'admin', role: Role.ADMIN };
const mockRegularUser: JwtUser = {
  id: 2,
  username: 'john_doe',
  role: Role.USER,
};

// Factory — creates a JwtAuthGuard override that attaches a specific user
const createAuthGuard = (user: JwtUser) => ({
  canActivate: (ctx: ExecutionContext) => {
    ctx.switchToHttp().getRequest().user = user;
    return true;
  },
});

const rejectAuthGuard = {
  canActivate: () => {
    throw new UnauthorizedException();
  },
};

// Shared app factory
const createApp = async (user: JwtUser): Promise<INestApplication<App>> => {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [RoomsController],
    providers: [
      { provide: RoomsService, useValue: mockRoomsService },
      RolesGuard,
      Reflector,
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue(createAuthGuard(user))
    // CacheInterceptor requires CacheModule — override to pass-through in tests
    .overrideInterceptor(CacheInterceptor)
    .useValue({ intercept: (_ctx: any, next: any) => next.handle() })
    .compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
};

describe('RoomsController (Integration)', () => {
  let adminApp: INestApplication<App>;
  let userApp: INestApplication<App>;
  let unauthApp: INestApplication<App>;

  beforeAll(async () => {
    adminApp = await createApp(mockAdminUser);
    userApp = await createApp(mockRegularUser);

    // Unauthenticated app
    const unauthModule = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [
        { provide: RoomsService, useValue: mockRoomsService },
        RolesGuard,
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(rejectAuthGuard)
      .overrideInterceptor(CacheInterceptor)
      .useValue({ intercept: (_ctx: any, next: any) => next.handle() })
      .compile();

    unauthApp = unauthModule.createNestApplication();
    unauthApp.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await unauthApp.init();
  });

  afterAll(async () => {
    await adminApp.close();
    await userApp.close();
    await unauthApp.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /rooms ───────────────────────────────────────────────────────────

  describe('GET /rooms', () => {
    it('should return 200 with list of active rooms (public)', async () => {
      // Arrange
      mockRoomsService.findAll.mockResolvedValue([mockRoom]);

      // Act & Assert
      const res = await request(adminApp.getHttpServer())
        .get('/rooms')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].id).toBe(1);
    });
  });

  // ─── GET /rooms/search ────────────────────────────────────────────────────

  describe('GET /rooms/search', () => {
    it('should return 200 with available rooms when dates are valid', async () => {
      // Arrange
      mockRoomsService.searchAvailable.mockResolvedValue([mockRoom]);

      // Act & Assert
      const res = await request(adminApp.getHttpServer())
        .get(
          '/rooms/search?checkIn=2025-06-01T14:00:00Z&checkOut=2025-06-05T12:00:00Z',
        )
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 400 if service throws BadRequestException for invalid dates', async () => {
      // Arrange
      mockRoomsService.searchAvailable.mockRejectedValue(
        new BadRequestException('checkIn must be before checkOut'),
      );

      // Act & Assert
      await request(adminApp.getHttpServer())
        .get(
          '/rooms/search?checkIn=2025-06-05T12:00:00Z&checkOut=2025-06-01T14:00:00Z',
        )
        .expect(400);
    });
  });

  // ─── GET /rooms/:id ───────────────────────────────────────────────────────

  describe('GET /rooms/:id', () => {
    it('should return 200 with room details (public)', async () => {
      // Arrange
      mockRoomsService.findOne.mockResolvedValue(mockRoom);

      // Act & Assert
      const res = await request(adminApp.getHttpServer())
        .get('/rooms/1')
        .expect(200);
      expect(res.body.id).toBe(1);
    });

    it('should return 404 if room does not exist', async () => {
      // Arrange
      mockRoomsService.findOne.mockRejectedValue(
        new NotFoundException('Room #99 not found'),
      );

      // Act & Assert
      await request(adminApp.getHttpServer()).get('/rooms/99').expect(404);
    });
  });

  // ─── POST /rooms ──────────────────────────────────────────────────────────

  describe('POST /rooms', () => {
    const validRoom = {
      name: 'Standard Room 101',
      capacity: 2,
      pricePerNight: 1800,
    };

    it('should return 201 when admin creates a room', async () => {
      // Arrange
      mockRoomsService.create.mockResolvedValue({ id: 2, ...validRoom });

      // Act & Assert
      const res = await request(adminApp.getHttpServer())
        .post('/rooms')
        .send(validRoom)
        .expect(201);

      expect(res.body.name).toBe('Standard Room 101');
    });

    it('should return 403 when a regular user tries to create a room', async () => {
      // Act & Assert — RolesGuard rejects because user role is USER not ADMIN
      await request(userApp.getHttpServer())
        .post('/rooms')
        .send(validRoom)
        .expect(403);
    });

    it('should return 401 when no token is provided', async () => {
      await request(unauthApp.getHttpServer())
        .post('/rooms')
        .send(validRoom)
        .expect(401);
    });

    it('should return 400 if required fields are missing', async () => {
      await request(adminApp.getHttpServer())
        .post('/rooms')
        .send({ name: 'Incomplete Room' }) // missing capacity and pricePerNight
        .expect(400);
    });
  });

  // ─── PATCH /rooms/:id/disable and enable ─────────────────────────────────

  describe('PATCH /rooms/:id/disable', () => {
    it('should return 200 when admin disables a room', async () => {
      // Arrange
      mockRoomsService.disable.mockResolvedValue({
        ...mockRoom,
        isActive: false,
      });

      // Act & Assert
      const res = await request(adminApp.getHttpServer())
        .patch('/rooms/1/disable')
        .expect(200);

      expect(res.body.isActive).toBe(false);
    });

    it('should return 403 when a regular user tries to disable a room', async () => {
      await request(userApp.getHttpServer())
        .patch('/rooms/1/disable')
        .expect(403);
    });
  });

  describe('PATCH /rooms/:id/enable', () => {
    it('should return 200 when admin enables a room', async () => {
      // Arrange
      mockRoomsService.enable.mockResolvedValue({
        ...mockRoom,
        isActive: true,
      });

      // Act & Assert
      const res = await request(adminApp.getHttpServer())
        .patch('/rooms/1/enable')
        .expect(200);

      expect(res.body.isActive).toBe(true);
    });
  });

  // ─── DELETE /rooms/:id ────────────────────────────────────────────────────

  describe('DELETE /rooms/:id', () => {
    it('should return 200 when admin deletes a room', async () => {
      // Arrange
      mockRoomsService.remove.mockResolvedValue(mockRoom);

      // Act & Assert
      await request(adminApp.getHttpServer()).delete('/rooms/1').expect(200);
    });

    it('should return 403 when a regular user tries to delete a room', async () => {
      await request(userApp.getHttpServer()).delete('/rooms/1').expect(403);
    });
  });
});
