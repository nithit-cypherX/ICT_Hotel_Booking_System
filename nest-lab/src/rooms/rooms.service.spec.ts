import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  room: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  booking: {
    findMany: jest.fn(),
  },
};

const mockRoom = {
  id: 1,
  name: 'Deluxe Room 201',
  description: 'City view room',
  capacity: 2,
  pricePerNight: 2800,
  imageUrl: '/images/room201.jpg',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('RoomsService', () => {
  let service: RoomsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return only active rooms', async () => {
      // Arrange
      const mockRooms = [mockRoom];
      mockPrismaService.room.findMany.mockResolvedValue(mockRooms);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toBe(mockRooms);
      expect(mockPrismaService.room.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a room if found', async () => {
      // Arrange
      mockPrismaService.room.findUnique.mockResolvedValue(mockRoom);

      // Act
      const result = await service.findOne(1);

      // Assert
      expect(result).toBe(mockRoom);
      expect(mockPrismaService.room.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException if room does not exist', async () => {
      // Arrange
      mockPrismaService.room.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create and return a new room', async () => {
      // Arrange
      const dto = {
        name: 'Deluxe Room 201',
        capacity: 2,
        pricePerNight: 2800,
      };
      const createdRoom = { id: 1, ...dto, isActive: true };
      mockPrismaService.room.create.mockResolvedValue(createdRoom);

      // Act
      const result = await service.create(dto as any);

      // Assert
      expect(result).toBe(createdRoom);
      expect(mockPrismaService.room.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update and return the room', async () => {
      // Arrange
      const dto = { pricePerNight: 3500 };
      const updatedRoom = { ...mockRoom, pricePerNight: 3500 };
      mockPrismaService.room.findUnique.mockResolvedValue(mockRoom);
      mockPrismaService.room.update.mockResolvedValue(updatedRoom);

      // Act
      const result = await service.update(1, dto as any);

      // Assert
      expect(result).toBe(updatedRoom);
      expect(mockPrismaService.room.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: dto,
      });
    });

    it('should throw NotFoundException if room does not exist', async () => {
      // Arrange
      mockPrismaService.room.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(99, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delete and return the room', async () => {
      // Arrange
      mockPrismaService.room.findUnique.mockResolvedValue(mockRoom);
      mockPrismaService.room.delete.mockResolvedValue(mockRoom);

      // Act
      const result = await service.remove(1);

      // Assert
      expect(result).toBe(mockRoom);
      expect(mockPrismaService.room.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException if room does not exist', async () => {
      // Arrange
      mockPrismaService.room.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── disable / enable ─────────────────────────────────────────────────────

  describe('disable', () => {
    it('should set isActive to false', async () => {
      // Arrange
      const disabledRoom = { ...mockRoom, isActive: false };
      mockPrismaService.room.findUnique.mockResolvedValue(mockRoom);
      mockPrismaService.room.update.mockResolvedValue(disabledRoom);

      // Act
      const result = await service.disable(1);

      // Assert
      expect(result.isActive).toBe(false);
      expect(mockPrismaService.room.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: false },
      });
    });

    it('should throw NotFoundException if room does not exist', async () => {
      // Arrange
      mockPrismaService.room.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.disable(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('enable', () => {
    it('should set isActive to true', async () => {
      // Arrange
      const inactiveRoom = { ...mockRoom, isActive: false };
      const enabledRoom = { ...mockRoom, isActive: true };
      mockPrismaService.room.findUnique.mockResolvedValue(inactiveRoom);
      mockPrismaService.room.update.mockResolvedValue(enabledRoom);

      // Act
      const result = await service.enable(1);

      // Assert
      expect(result.isActive).toBe(true);
      expect(mockPrismaService.room.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: true },
      });
    });
  });

  // ─── searchAvailable ──────────────────────────────────────────────────────

  describe('searchAvailable', () => {
    it('should throw BadRequestException if checkIn is missing', async () => {
      await expect(
        service.searchAvailable('', '2025-06-05T12:00:00Z'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if dates are invalid format', async () => {
      await expect(
        service.searchAvailable('not-a-date', '2025-06-05T12:00:00Z'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if checkIn is not before checkOut', async () => {
      await expect(
        service.searchAvailable('2025-06-05T12:00:00Z', '2025-06-01T14:00:00Z'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return available rooms excluding booked ones', async () => {
      // Arrange — room 2 is already booked, so only room 1 should come back
      mockPrismaService.booking.findMany.mockResolvedValue([{ roomId: 2 }]);
      mockPrismaService.room.findMany.mockResolvedValue([mockRoom]);

      // Act
      const result = await service.searchAvailable(
        '2025-06-01T14:00:00Z',
        '2025-06-05T12:00:00Z',
      );

      // Assert
      expect(result).toEqual([mockRoom]);
      expect(mockPrismaService.room.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            id: { notIn: [2] },
          }),
        }),
      );
    });

    it('should filter by capacity when provided', async () => {
      // Arrange
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockPrismaService.room.findMany.mockResolvedValue([mockRoom]);

      // Act
      await service.searchAvailable(
        '2025-06-01T14:00:00Z',
        '2025-06-05T12:00:00Z',
        2,
      );

      // Assert
      expect(mockPrismaService.room.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            capacity: { gte: 2 },
          }),
        }),
      );
    });
  });
});
