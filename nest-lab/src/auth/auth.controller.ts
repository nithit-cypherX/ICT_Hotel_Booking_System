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
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  // FR-1: Sign up
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() registerDto: RegisterDto) {
    this.logger.log(`Register attempt for username: ${registerDto.username}`);
    return this.authService.register(registerDto);
  }

  // FR-2: Login with username or email
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto) {
    this.logger.log(`Login attempt for identifier: ${loginDto.identifier}`);
    return this.authService.login(loginDto);
  }

  // FR-2: Logout — frontend removes the token, server confirms
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard) // must be logged in to log out
  logout(@CurrentUser() user: any) {
    this.logger.log(`Logout requested by user: ${user.username}`);
    return this.authService.logout();
  }

  // FR-3: View own profile — id comes from JWT, not from the URL
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: any) {
    this.logger.log(`User #${user.id} requested their own profile`);
    return this.authService.getMe(user.id);
  }

  // FR-4: Update own profile
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(
    @CurrentUser() user: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    this.logger.log(`User #${user.id} is updating their profile`);
    return this.authService.updateMe(user.id, updateProfileDto);
  }
}
