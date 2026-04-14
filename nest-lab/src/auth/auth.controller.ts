import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtUser } from './interfaces/jwt-user.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  // FR-1: sign up
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'User registered successfully' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            username: { type: 'string', example: 'john_doe' },
            email: { type: 'string', example: 'john@example.com' },
            name: { type: 'string', example: 'John Doe' },
            role: { type: 'string', example: 'USER' },
            createdAt: { type: 'string', example: '2025-06-01T10:00:00.000Z' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request — validation failed' })
  @ApiResponse({
    status: 409,
    description: 'Conflict — username or email already in use',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests — 10 per 15 minutes',
  })
  register(@Body() registerDto: RegisterDto) {
    this.logger.log(`Register attempt for username: ${registerDto.username}`);
    return this.authService.register(registerDto);
  }

  // FR-2: login with username or email
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiOperation({
    summary: 'Login with username or email to receive an access token',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged in successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            username: { type: 'string', example: 'john_doe' },
            email: { type: 'string', example: 'john@example.com' },
            name: { type: 'string', example: 'John Doe' },
            role: { type: 'string', example: 'USER' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request — validation failed' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — invalid credentials',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests — 5 per 15 minutes',
  })
  login(@Body() loginDto: LoginDto) {
    this.logger.log(`Login attempt for identifier: ${loginDto.identifier}`);
    return this.authService.login(loginDto);
  }

  // FR-2: logout — frontend removes the token, server confirms
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout — invalidates session on client side' })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Logged out successfully' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  logout(@CurrentUser() user: JwtUser) {
    this.logger.log(`Logout requested by user: ${user.username}`);
    return this.authService.logout();
  }

  // FR-3: view own profile
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the currently logged-in user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile fetched successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        username: { type: 'string', example: 'john_doe' },
        email: { type: 'string', example: 'john@example.com' },
        name: { type: 'string', example: 'John Doe' },
        role: { type: 'string', example: 'USER' },
        createdAt: { type: 'string', example: '2025-06-01T10:00:00.000Z' },
        updatedAt: { type: 'string', example: '2025-06-01T10:00:00.000Z' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  getMe(@CurrentUser() user: JwtUser) {
    this.logger.log(`User #${user.id} requested their own profile`);
    return this.authService.getMe(user.id);
  }

  // FR-4: update own profile
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update the currently logged-in user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        username: { type: 'string', example: 'john_updated' },
        email: { type: 'string', example: 'john_updated@example.com' },
        name: { type: 'string', example: 'John Updated' },
        role: { type: 'string', example: 'USER' },
        updatedAt: { type: 'string', example: '2025-06-01T12:00:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request — validation failed' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict — username or email already in use',
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  updateMe(
    @CurrentUser() user: JwtUser,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    this.logger.log(`User #${user.id} is updating their profile`);
    return this.authService.updateMe(user.id, updateProfileDto);
  }
}
