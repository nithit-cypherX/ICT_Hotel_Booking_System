import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

// Fields that are safe to return — password is never included
const SAFE_USER_FIELDS = {
  id: true,
  username: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // FR-1: Sign up with username, email, name, password
  // Role is always USER — no client can self-assign ADMIN
  async register(registerDto: RegisterDto) {
    try {
      const { username, email, name, password } = registerDto;

      // Check both username and email uniqueness upfront
      const existing = await this.prisma.user.findFirst({
        where: { OR: [{ username }, { email }] },
      });

      if (existing) {
        this.logger.error(
          `Registration failed: username "${username}" or email "${email}" is already in use`,
        );
        throw new ConflictException('Username or email is already in use');
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const newUser = await this.prisma.user.create({
        data: { username, email, name, password: hashedPassword },
        select: SAFE_USER_FIELDS,
      });

      this.logger.log(`New user registered successfully: ${newUser.username}`);

      return {
        message: 'User registered successfully',
        user: newUser,
      };
    } catch (error) {
      this.logger.error(`Registration failed: ${error.message}`);
      throw error;
    }
  }

  // FR-2: Login — accepts either username or email as the identifier
  async login(loginDto: LoginDto) {
    try {
      const { identifier, password } = loginDto;

      // Try matching identifier against both username and email columns
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [{ username: identifier }, { email: identifier }],
        },
      });

      if (!user || !(await bcrypt.compare(password, user.password))) {
        this.logger.error(
          `Login failed: invalid credentials for identifier "${identifier}"`,
        );
        throw new UnauthorizedException('Invalid credentials');
      }

      // Role is included in the payload so RolesGuard can read it via JwtStrategy.validate()
      const payload = { sub: user.id, username: user.username, role: user.role };

      this.logger.log(`User logged in successfully: ${user.username}`);

      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch (error) {
      this.logger.error(`Login failed: ${error.message}`);
      throw error;
    }
  }

  // FR-2: Logout — JWT is stateless so logout is handled on the frontend.
  // The server simply confirms the action. The client must discard the token.
  logout() {
    this.logger.log('User logged out (client-side token removal)');
    return { message: 'Logged out successfully' };
  }

  // FR-3: View own profile — uses id from JWT, not from URL params
  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: SAFE_USER_FIELDS,
    });

    if (!user) {
      this.logger.error(`getMe failed: User #${userId} not found`);
      throw new NotFoundException('User not found');
    }

    this.logger.log(`User #${userId} fetched their own profile`);
    return user;
  }

  // FR-4: Update own profile — users can change username, email, name, password
  // Role is intentionally excluded — users cannot promote themselves
  async updateMe(userId: number, updateProfileDto: UpdateProfileDto) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        this.logger.error(`updateMe failed: User #${userId} not found`);
        throw new NotFoundException('User not found');
      }

      // If username or email is changing, check it isn't already taken by someone else
      if (updateProfileDto.username || updateProfileDto.email) {
        const conflict = await this.prisma.user.findFirst({
          where: {
            id: { not: userId }, // exclude the current user from this check
            OR: [
              ...(updateProfileDto.username
                ? [{ username: updateProfileDto.username }]
                : []),
              ...(updateProfileDto.email
                ? [{ email: updateProfileDto.email }]
                : []),
            ],
          },
        });

        if (conflict) {
          this.logger.error(
            `updateMe failed: username or email already in use for user #${userId}`,
          );
          throw new ConflictException('Username or email is already in use');
        }
      }

      // Hash the new password if one was provided
      const dataToUpdate: any = { ...updateProfileDto };
      if (updateProfileDto.password) {
        dataToUpdate.password = await bcrypt.hash(updateProfileDto.password, 12);
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: dataToUpdate,
        select: SAFE_USER_FIELDS,
      });

      this.logger.log(`User #${userId} updated their profile successfully`);
      return updatedUser;
    } catch (error) {
      this.logger.error(`updateMe failed for user #${userId}: ${error.message}`);
      throw error;
    }
  }
}
