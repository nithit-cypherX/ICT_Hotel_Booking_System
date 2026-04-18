import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock bcrypt so tests never do real hashing — keeps tests fast and deterministic
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));
import * as bcrypt from 'bcrypt';

const mockPrismaService = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock_access_token'),
};

const mockUser = {
  id: 1,
  username: 'john_doe',
  email: 'john@example.com',
  name: 'John Doe',
  password: 'hashed_password',
  role: 'USER',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Safe user — what we expect to be returned (no password field)
const safeUser = {
  id: 1,
  username: 'john_doe',
  email: 'john@example.com',
  name: 'John Doe',
  role: 'USER',
  createdAt: mockUser.createdAt,
  updatedAt: mockUser.updatedAt,
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── register ─────────────────────────────────────────────────────────────

  describe('register', () => {
    const registerDto = {
      username: 'john_doe',
      email: 'john@example.com',
      name: 'John Doe',
      password: 'password123',
    };

    it('should register a new user and return safe user data', async () => {
      // Arrange
      mockPrismaService.user.findFirst.mockResolvedValue(null); // no duplicate
      mockPrismaService.user.create.mockResolvedValue(safeUser);

      // Act
      const result = await service.register(registerDto);

      // Assert
      expect(result.message).toBe('User registered successfully');
      expect(result.user).toBe(safeUser);
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
    });

    it('should throw ConflictException if username or email already exists', async () => {
      // Arrange — simulate existing user
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should login successfully using username as identifier', async () => {
      // Arrange
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await service.login({
        identifier: 'john_doe',
        password: 'password123',
      });

      // Assert
      expect(result.access_token).toBe('mock_access_token');
      expect(result.user.username).toBe('john_doe');
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        username: mockUser.username,
        role: mockUser.role,
      });
    });

    it('should login successfully using email as identifier', async () => {
      // Arrange
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await service.login({
        identifier: 'john@example.com',
        password: 'password123',
      });

      // Assert — identifier passed to OR query so both username and email are checked
      expect(result.access_token).toBe('mock_access_token');
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ username: 'john@example.com' }, { email: 'john@example.com' }],
        },
      });
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      // Arrange
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.login({ identifier: 'ghost', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      // Arrange
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false); // wrong password

      // Act & Assert
      await expect(
        service.login({ identifier: 'john_doe', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── logout ───────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should return a success message', () => {
      // Act
      const result = service.logout();

      // Assert
      expect(result.message).toBe('Logged out successfully');
    });
  });

  // ─── getMe ────────────────────────────────────────────────────────────────

  describe('getMe', () => {
    it('should return the user profile by id', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(safeUser);

      // Act
      const result = await service.getMe(1);

      // Assert
      expect(result).toBe(safeUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getMe(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateMe ─────────────────────────────────────────────────────────────

  describe('updateMe', () => {
    it('should update and return the user profile', async () => {
      // Arrange
      const updatedUser = { ...safeUser, name: 'John Updated' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.findFirst.mockResolvedValue(null); // no conflict
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await service.updateMe(1, { name: 'John Updated' });

      // Assert
      expect(result).toBe(updatedUser);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateMe(99, { name: 'Ghost' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if new username is already taken', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 99,
        username: 'taken',
      }); // conflict

      // Act & Assert
      await expect(service.updateMe(1, { username: 'taken' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should hash the password if a new password is provided', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.update.mockResolvedValue(safeUser);

      // Act
      await service.updateMe(1, { password: 'newpassword123' });

      // Assert — bcrypt.hash must have been called for the new password
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 12);
    });
  });
});
