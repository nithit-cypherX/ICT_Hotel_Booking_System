import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const mockPrismaService = {
  booking: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  room: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

const mockNotificationsService = {
  create: jest.fn(),
};

const mockRoom = {
  id: 1,
  name: 'Deluxe Room 201',
  isActive: true,
  pricePerNight: 2800,
};

const mockBooking = {
  id: 1,
  userId: 1,
  roomId: 1,
  checkIn: new Date('2025-06-01T14:00:00Z'),
  checkOut: new Date('2025-06-05T12:00:00Z'),
  status: 'PENDING',
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { id: 1, name: 'John Doe', email: 'john@example.com' },
  room: mockRoom,
};

describe('BookingsService', () => {
  let service: BookingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const validDto = {
      roomId: 1,
      checkIn: '2025-06-01T14:00:00Z',
      checkOut: '2025-06-05T12:00:00Z',
    };

    it('should create a booking with PENDING status and trigger a notification', async () => {
      // Arrange
      mockPrismaService.room.findUnique.mockResolvedValue(mockRoom);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.booking.findFirst.mockResolvedValue(null); // no conflict
      mockPrismaService.booking.create.mockResolvedValue(mockBooking);

      // Act
      const result = await service.create(1, validDto);

      // Assert
      expect(result).toBe(mockBooking);
      expect(mockPrismaService.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PENDING', userId: 1 }),
        }),
      );
      // FR-30: notification must be fired after booking is created
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'BOOKING_CREATED', userId: 1 }),
      );
    });

    it('should throw BadRequestException if checkIn is not before checkOut', async () => {
      // Arrange — reversed dates
      const dto = {
        roomId: 1,
        checkIn: '2025-06-05T12:00:00Z',
        checkOut: '2025-06-01T14:00:00Z',
      };

      // Act & Assert
      await expect(service.create(1, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if room does not exist', async () => {
      // Arrange
      mockPrismaService.room.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(1, validDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if room is not active', async () => {
      // Arrange
      mockPrismaService.room.findUnique.mockResolvedValue({
        ...mockRoom,
        isActive: false,
      });

      // Act & Assert
      await expect(service.create(1, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if room is already booked for selected dates (FR-20)', async () => {
      // Arrange
      mockPrismaService.room.findUnique.mockResolvedValue(mockRoom);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking); // conflict found

      // Act & Assert
      await expect(service.create(1, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all bookings when called by an ADMIN', async () => {
      // Arrange
      const allBookings = [mockBooking, { ...mockBooking, id: 2, userId: 2 }];
      mockPrismaService.booking.findMany.mockResolvedValue(allBookings);

      // Act
      const result = await service.findAll(1, Role.ADMIN);

      // Assert
      expect(result).toBe(allBookings);
      // Admin query — no where filter on userId
      expect(mockPrismaService.booking.findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({ where: { userId: 1 } }),
      );
    });

    it("should return only the user's own bookings when called by a USER", async () => {
      // Arrange
      const ownBookings = [mockBooking];
      mockPrismaService.booking.findMany.mockResolvedValue(ownBookings);

      // Act
      const result = await service.findAll(1, Role.USER);

      // Assert
      expect(result).toBe(ownBookings);
      expect(mockPrismaService.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1 } }),
      );
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should throw NotFoundException if booking does not exist', async () => {
      // Arrange
      mockPrismaService.booking.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(99, 1, Role.USER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return any booking when called by an ADMIN', async () => {
      // Arrange — booking belongs to userId 5, but admin (id: 1) can still access it
      const otherUserBooking = { ...mockBooking, userId: 5 };
      mockPrismaService.booking.findUnique.mockResolvedValue(otherUserBooking);

      // Act
      const result = await service.findOne(1, 1, Role.ADMIN);

      // Assert
      expect(result).toBe(otherUserBooking);
    });

    it('should return the booking when the owner requests it', async () => {
      // Arrange
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);

      // Act
      const result = await service.findOne(1, 1, Role.USER);

      // Assert
      expect(result).toBe(mockBooking);
    });

    it("should throw ForbiddenException if a USER requests another user's booking (FR-24)", async () => {
      // Arrange — booking belongs to userId 2, requester is userId 1
      const otherUserBooking = { ...mockBooking, userId: 2 };
      mockPrismaService.booking.findUnique.mockResolvedValue(otherUserBooking);

      // Act & Assert
      await expect(service.findOne(1, 1, Role.USER)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── updateStatus ─────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should throw NotFoundException if booking does not exist', async () => {
      // Arrange
      mockPrismaService.booking.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updateStatus(99, { status: 'APPROVED' }, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if booking is already CANCELLED', async () => {
      // Arrange
      mockPrismaService.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: 'CANCELLED',
      });

      // Act & Assert
      await expect(
        service.updateStatus(1, { status: 'APPROVED' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if booking is already PAID', async () => {
      // Arrange
      mockPrismaService.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: 'PAID',
      });

      // Act & Assert
      await expect(
        service.updateStatus(1, { status: 'CANCELLED' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update status to APPROVED successfully', async () => {
      // Arrange
      const updatedBooking = { ...mockBooking, status: 'APPROVED' };
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrismaService.booking.update.mockResolvedValue(updatedBooking);

      // Act
      const result = await service.updateStatus(1, { status: 'APPROVED' }, 1);

      // Assert
      expect(result).toBe(updatedBooking);
      // No notification for APPROVED status
      expect(mockNotificationsService.create).not.toHaveBeenCalled();
    });

    it('should trigger BOOKING_CANCELLED notification when status changes to CANCELLED (FR-31)', async () => {
      // Arrange
      const updatedBooking = { ...mockBooking, status: 'CANCELLED' };
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrismaService.booking.update.mockResolvedValue(updatedBooking);

      // Act
      await service.updateStatus(1, { status: 'CANCELLED' }, 1);

      // Assert
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'BOOKING_CANCELLED', bookingId: 1 }),
      );
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delete the booking and return a confirmation message', async () => {
      // Arrange
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrismaService.booking.delete.mockResolvedValue(mockBooking);

      // Act
      const result = await service.remove(1, 1);

      // Assert
      expect(result).toEqual({ message: 'Booking #1 has been deleted' });
      expect(mockPrismaService.booking.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException if booking does not exist', async () => {
      // Arrange
      mockPrismaService.booking.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(99, 1)).rejects.toThrow(NotFoundException);
    });
  });
});
