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
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  // FR-1: sign up
  // Stricter limit — prevents spam account creation
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 requests per 15 minutes
  register(@Body() registerDto: RegisterDto) {
    this.logger.log(`Register attempt for username: ${registerDto.username}`);
    return this.authService.register(registerDto);
  }

  // FR-2: login with username or email
  // Strictest limit — prevents brute-force password guessing
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes
  login(@Body() loginDto: LoginDto) {
    this.logger.log(`Login attempt for identifier: ${loginDto.identifier}`);
    return this.authService.login(loginDto);
  }

  // FR-2: logout — frontend removes the token, server confirms
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: JwtUser) {
    this.logger.log(`Logout requested by user: ${user.username}`);
    return this.authService.logout();
  }

  // FR-3: view own profile — id comes from JWT, not from the URL
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: JwtUser) {
    this.logger.log(`User #${user.id} requested their own profile`);
    return this.authService.getMe(user.id);
  }

  // FR-4: update own profile
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(
    @CurrentUser() user: JwtUser,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    this.logger.log(`User #${user.id} is updating their profile`);
    return this.authService.updateMe(user.id, updateProfileDto);
  }
}
