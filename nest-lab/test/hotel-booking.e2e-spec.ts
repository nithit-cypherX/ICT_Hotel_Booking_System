import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Mock Redis so the app starts cleanly in CI environments without a Redis server
jest.mock('cache-manager-redis-yet', () => ({
  redisStore: () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(null),
    reset: jest.fn().mockResolvedValue(null),
    keys: jest.fn().mockResolvedValue([]),
    mget: jest.fn().mockResolvedValue([]),
    store: { name: 'mock-redis' },
  }),
}));

describe('Hotel Booking API (E2E)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Track created resource IDs so we can clean them up in afterAll
  let adminUserId: number;
  let regularUserId: number;
  let createdRoomId: number;
  let createdBookingId: number;
  let adminToken: string;
  let userToken: string;

  // ─── Setup ─────────────────────────────────────────────────────────────

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create a test admin user directly via Prisma — register endpoint cannot set ADMIN role
    const adminUsername = `e2e_admin_${Date.now()}`;
    const adminUser = await prisma.user.create({
      data: {
        username: adminUsername,
        email: `${adminUsername}@test.com`,
        name: 'E2E Admin',
        password: await bcrypt.hash('adminpass123', 10),
        role: 'ADMIN',
      },
    });
    adminUserId = adminUser.id;

    // Login as admin to get the admin token
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: adminUsername, password: 'adminpass123' })
      .expect(200);

    adminToken = adminLogin.body.access_token;
  });

  // ─── Cleanup ────────────────────────────────────────────────────────────

  afterAll(async () => {
    // Delete in dependency order: notifications → bookings → rooms → users
    if (createdBookingId) {
      await prisma.notification.deleteMany({
        where: { bookingId: createdBookingId },
      });
      await prisma.booking.deleteMany({ where: { id: createdBookingId } });
    }
    if (createdRoomId) {
      await prisma.room.deleteMany({ where: { id: createdRoomId } });
    }
    if (regularUserId) {
      await prisma.user.deleteMany({ where: { id: regularUserId } });
    }
    if (adminUserId) {
      await prisma.user.deleteMany({ where: { id: adminUserId } });
    }
    await app.close();
  });

  // ─── Step 1: Register a new regular user ────────────────────────────────

  describe('Step 1: User Registration (FR-1)', () => {
    it('should register a new user and return 201', async () => {
      const username = `e2e_user_${Date.now()}`;

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username,
          email: `${username}@test.com`,
          name: 'E2E User',
          password: 'userpass123',
        })
        .expect(201);

      regularUserId = res.body.user.id;
      expect(res.body.message).toBe('User registered successfully');
      expect(res.body.user.role).toBe('USER');
      // Password must never appear in the response
      expect(res.body.user.password).toBeUndefined();
    });

    it('should return 409 if the same username is registered again', async () => {
      // We need to find the username we just used — re-register with same email should conflict
      const adminUser = await prisma.user.findUnique({
        where: { id: adminUserId },
      });

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username: adminUser!.username,
          email: 'differentemail@test.com',
          name: 'Duplicate',
          password: 'password123',
        })
        .expect(409);
    });
  });

  // ─── Step 2: Login ──────────────────────────────────────────────────────

  describe('Step 2: User Login (FR-2)', () => {
    it('should login the regular user and return an access token', async () => {
      const regularUser = await prisma.user.findUnique({
        where: { id: regularUserId },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: regularUser!.username, password: 'userpass123' })
        .expect(200);

      userToken = res.body.access_token;
      expect(userToken).toBeDefined();
      expect(res.body.user.role).toBe('USER');
    });

    it('should return 401 on invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: 'ghost_user', password: 'wrongpassword' })
        .expect(401);
    });
  });

  // ─── Step 3: View own profile ───────────────────────────────────────────

  describe('Step 3: View Own Profile (FR-3)', () => {
    it('should return the user profile when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.id).toBe(regularUserId);
      expect(res.body.password).toBeUndefined();
    });

    it('should return 401 when no token is provided', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });
  });

  // ─── Step 4: Admin creates a room ───────────────────────────────────────

  describe('Step 4: Admin Creates a Room (FR-8)', () => {
    it('should create a room and return 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Test Suite Room',
          description: 'Created during E2E tests',
          capacity: 2,
          pricePerNight: 2800,
          imageUrl: '/images/e2e-room.jpg',
          isActive: true,
        })
        .expect(201);

      createdRoomId = res.body.id;
      expect(res.body.name).toBe('E2E Test Suite Room');
    });

    it('should return 403 when a regular user tries to create a room', async () => {
      await request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Forbidden Room', capacity: 1, pricePerNight: 999 })
        .expect(403);
    });
  });

  // ─── Step 5: Search available rooms ─────────────────────────────────────

  describe('Step 5: Search Available Rooms (FR-27, FR-29)', () => {
    it('should return available rooms for the test dates', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/rooms/search?checkIn=2025-08-01T14:00:00Z&checkOut=2025-08-05T12:00:00Z',
        )
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // Our newly created room should appear since it has no bookings yet
      const found = res.body.find((r: any) => r.id === createdRoomId);
      expect(found).toBeDefined();
    });

    it('should return 400 if dates are invalid', async () => {
      await request(app.getHttpServer())
        .get(
          '/rooms/search?checkIn=2025-08-05T14:00:00Z&checkOut=2025-08-01T12:00:00Z',
        )
        .expect(400);
    });
  });

  // ─── Step 6: User creates a booking ─────────────────────────────────────

  describe('Step 6: User Creates a Booking (FR-17, FR-18, FR-22)', () => {
    it('should create a booking with PENDING status', async () => {
      const res = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          roomId: createdRoomId,
          checkIn: '2025-08-01T14:00:00Z',
          checkOut: '2025-08-05T12:00:00Z',
        })
        .expect(201);

      createdBookingId = res.body.id;
      expect(res.body.status).toBe('PENDING');
      expect(res.body.userId).toBe(regularUserId);
    });

    it('should return 400 if the same room is booked for overlapping dates (FR-20)', async () => {
      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          roomId: createdRoomId,
          checkIn: '2025-08-03T14:00:00Z', // overlaps with existing booking
          checkOut: '2025-08-07T12:00:00Z',
        })
        .expect(400);
    });

    it('should return 401 if no token is provided', async () => {
      await request(app.getHttpServer())
        .post('/bookings')
        .send({
          roomId: createdRoomId,
          checkIn: '2025-09-01T14:00:00Z',
          checkOut: '2025-09-05T12:00:00Z',
        })
        .expect(401);
    });
  });

  // ─── Step 7: User views own bookings ────────────────────────────────────

  describe('Step 7: User Views Own Bookings (FR-23, FR-24)', () => {
    it("should return the user's own bookings", async () => {
      const res = await request(app.getHttpServer())
        .get('/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((b: any) => b.id === createdBookingId);
      expect(found).toBeDefined();
      // Every booking in the list must belong to this user
      res.body.forEach((b: any) => expect(b.userId).toBe(regularUserId));
    });

    it('should return the specific booking details for the owner', async () => {
      const res = await request(app.getHttpServer())
        .get(`/bookings/${createdBookingId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.id).toBe(createdBookingId);
    });
  });

  // ─── Step 8: Admin approves the booking ─────────────────────────────────

  describe('Step 8: Admin Updates Booking Status (FR-26)', () => {
    it('should approve the booking and return APPROVED status', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/bookings/${createdBookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'APPROVED' })
        .expect(200);

      expect(res.body.status).toBe('APPROVED');
    });

    it('should return 403 when a regular user tries to update booking status', async () => {
      await request(app.getHttpServer())
        .patch(`/bookings/${createdBookingId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'APPROVED' })
        .expect(403);
    });
  });

  // ─── Step 9: Admin cancels the booking ──────────────────────────────────

  describe('Step 9: Admin Cancels Booking — triggers notification (FR-31)', () => {
    it('should cancel the booking and create a BOOKING_CANCELLED notification', async () => {
      await request(app.getHttpServer())
        .patch(`/bookings/${createdBookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CANCELLED' })
        .expect(200);

      // Verify the cancellation notification was recorded in the DB
      const notification = await prisma.notification.findFirst({
        where: { bookingId: createdBookingId, type: 'BOOKING_CANCELLED' },
      });
      expect(notification).not.toBeNull();
      expect(notification!.userId).toBe(regularUserId);
    });
  });

  // ─── Step 10: User views notifications ──────────────────────────────────

  describe('Step 10: User Views Notifications (FR-30, FR-31)', () => {
    it('should return notifications for the logged-in user', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // All notifications must belong to this user
      res.body.forEach((n: any) => expect(n.userId).toBe(regularUserId));
    });

    it('should mark a notification as read', async () => {
      // Find the BOOKING_CREATED notification
      const notification = await prisma.notification.findFirst({
        where: { bookingId: createdBookingId, type: 'BOOKING_CREATED' },
      });

      if (notification) {
        const res = await request(app.getHttpServer())
          .patch(`/notifications/${notification.id}/read`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(res.body.isRead).toBe(true);
      }
    });
  });
});
