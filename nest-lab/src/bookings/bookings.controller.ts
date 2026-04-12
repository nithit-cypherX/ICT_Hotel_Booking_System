import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';

@Controller('bookings')
@UseGuards(JwtAuthGuard) // every booking route requires a valid JWT
export class BookingsController {
  private readonly logger = new Logger(BookingsController.name);

  constructor(private readonly bookingsService: BookingsService) {}

  // FR-17, FR-18: any logged-in user can create a booking
  // userId is sourced from the token — not the request body
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: JwtUser,
    @Body() createBookingDto: CreateBookingDto,
  ) {
    this.logger.log(
      `User #${user.id} is creating a booking for room #${createBookingDto.roomId}`,
    );
    return this.bookingsService.create(user.id, createBookingDto);
  }

  // FR-23, FR-25: admin gets all bookings, user gets only their own
  @Get()
  findAll(@CurrentUser() user: JwtUser) {
    this.logger.log(`Bookings list requested by ${user.role} #${user.id}`);
    return this.bookingsService.findAll(user.id, user.role);
  }

  // FR-24, FR-25: admin can fetch any booking, user can only fetch their own
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    this.logger.log(
      `Booking #${id} details requested by ${user.role} #${user.id}`,
    );
    return this.bookingsService.findOne(id, user.id, user.role);
  }

  // FR-26: admin-only — update the status of any booking
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    this.logger.log(
      `Admin #${user.id} is updating status of booking #${id} to "${updateStatusDto.status}"`,
    );
    return this.bookingsService.updateStatus(id, updateStatusDto, user.id);
  }

  // Admin-only hard delete
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    this.logger.log(`Admin #${user.id} is deleting booking #${id}`);
    return this.bookingsService.remove(id, user.id);
  }
}
