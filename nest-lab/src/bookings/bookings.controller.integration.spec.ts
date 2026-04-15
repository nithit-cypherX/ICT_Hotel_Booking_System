import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '@prisma/client';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';

const mockBookingsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  updateStatus: jest.fn(),
  remove: jest.fn(),
};

const mockBooking = {
  id: 1,
  userId: 2,
  roomId: 1,
  checkIn: '2025-06-01T14:00:00.000Z',
  checkOut: '2025-06-05T12:00:00.000Z',
  status: 'PENDING',
  user: { id: 2, name: 'John Doe', email: 'john@example.com' },
  room: { id: 1, name: 'Deluxe Room 201' },
};

const mockAdminUser: JwtUser = { id: 1, username: 'admin', role: Role.ADMIN };
const mockRegularUser: JwtUser = {
  id: 2,
  username: 'john_doe',
  role: Role.USER,
};

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

const createApp = async (user: JwtUser): Promise<INestApplication<App>> => {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [BookingsController],
    providers: [
      { provide: BookingsService, useValue: mockBookingsService },
      RolesGuard,
      Reflector,
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue(createAuthGuard(user))
    .compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
};

describe('BookingsController (Integration)', () => {
  let adminApp: INestApplication<App>;
  let userApp: INestApplication<App>;
  let unauthApp: INestApplication<App>;

  beforeAll(async () => {
    adminApp = await createApp(mockAdminUser);
    userApp = await createApp(mockRegularUser);

    const unauthModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        { provide: BookingsService, useValue: mockBookingsService },
        RolesGuard,
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(rejectAuthGuard)
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

  // ─── POST /bookings ───────────────────────────────────────────────────────

  describe('POST /bookings', () => {
    const validBooking = {
      roomId: 1,
      checkIn: '2025-06-01T14:00:00Z',
      checkOut: '2025-06-05T12:00:00Z',
    };

    it('should return 201 when a logged-in user creates a booking', async () => {
      // Arrange
      mockBookingsService.create.mockResolvedValue(mockBooking);

      // Act & Assert
      const res = await request(userApp.getHttpServer())
        .post('/bookings')
        .send(validBooking)
        .expect(201);

      expect(res.body.status).toBe('PENDING');
      // userId must come from the token — not the request body
      expect(mockBookingsService.create).toHaveBeenCalledWith(
        mockRegularUser.id,
        expect.objectContaining({ roomId: 1 }),
      );
    });

    it('should return 401 when no token is provided', async () => {
      await request(unauthApp.getHttpServer())
        .post('/bookings')
        .send(validBooking)
        .expect(401);
    });

    it('should return 400 if required fields are missing', async () => {
      await request(userApp.getHttpServer())
        .post('/bookings')
        .send({ roomId: 1 }) // missing checkIn and checkOut
        .expect(400);
    });
  });

  // ─── GET /bookings ────────────────────────────────────────────────────────

  describe('GET /bookings', () => {
    it('should return 200 — admin sees all bookings', async () => {
      // Arrange
      mockBookingsService.findAll.mockResolvedValue([mockBooking]);

      // Act & Assert
      const res = await request(adminApp.getHttpServer())
        .get('/bookings')
        .expect(200);
      expect(mockBookingsService.findAll).toHaveBeenCalledWith(
        mockAdminUser.id,
        Role.ADMIN,
      );
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 200 — user sees only their own bookings', async () => {
      // Arrange
      mockBookingsService.findAll.mockResolvedValue([mockBooking]);

      // Act & Assert
      await request(userApp.getHttpServer()).get('/bookings').expect(200);
      expect(mockBookingsService.findAll).toHaveBeenCalledWith(
        mockRegularUser.id,
        Role.USER,
      );
    });

    it('should return 401 when no token is provided', async () => {
      await request(unauthApp.getHttpServer()).get('/bookings').expect(401);
    });
  });

  // ─── GET /bookings/:id ────────────────────────────────────────────────────

  describe('GET /bookings/:id', () => {
    it('should return 200 when the booking owner requests it', async () => {
      // Arrange
      mockBookingsService.findOne.mockResolvedValue(mockBooking);

      // Act & Assert
      const res = await request(userApp.getHttpServer())
        .get('/bookings/1')
        .expect(200);
      expect(res.body.id).toBe(1);
    });

    it("should return 403 when a user tries to access another user's booking", async () => {
      // Arrange
      mockBookingsService.findOne.mockRejectedValue(
        new ForbiddenException(
          'You do not have permission to view this booking',
        ),
      );

      // Act & Assert
      await request(userApp.getHttpServer()).get('/bookings/1').expect(403);
    });

    it('should return 404 if booking does not exist', async () => {
      // Arrange
      mockBookingsService.findOne.mockRejectedValue(
        new NotFoundException('Booking #99 not found'),
      );

      // Act & Assert
      await request(userApp.getHttpServer()).get('/bookings/99').expect(404);
    });
  });

  // ─── PATCH /bookings/:id/status ───────────────────────────────────────────

  describe('PATCH /bookings/:id/status', () => {
    it('should return 200 when admin updates booking status', async () => {
      // Arrange
      const updatedBooking = { ...mockBooking, status: 'APPROVED' };
      mockBookingsService.updateStatus.mockResolvedValue(updatedBooking);

      // Act & Assert
      const res = await request(adminApp.getHttpServer())
        .patch('/bookings/1/status')
        .send({ status: 'APPROVED' })
        .expect(200);

      expect(res.body.status).toBe('APPROVED');
    });

    it('should return 403 when a regular user tries to update booking status', async () => {
      await request(userApp.getHttpServer())
        .patch('/bookings/1/status')
        .send({ status: 'APPROVED' })
        .expect(403);
    });

    it('should return 400 if status value is invalid', async () => {
      await request(adminApp.getHttpServer())
        .patch('/bookings/1/status')
        .send({ status: 'PENDING' }) // PENDING is excluded from UpdateStatusDto
        .expect(400);
    });
  });

  // ─── DELETE /bookings/:id ─────────────────────────────────────────────────

  describe('DELETE /bookings/:id', () => {
    it('should return 200 when admin deletes a booking', async () => {
      // Arrange
      mockBookingsService.remove.mockResolvedValue({
        message: 'Booking #1 has been deleted',
      });

      // Act & Assert
      const res = await request(adminApp.getHttpServer())
        .delete('/bookings/1')
        .expect(200);
      expect(res.body.message).toBe('Booking #1 has been deleted');
    });

    it('should return 403 when a regular user tries to delete a booking', async () => {
      await request(userApp.getHttpServer()).delete('/bookings/1').expect(403);
    });
  });
});
