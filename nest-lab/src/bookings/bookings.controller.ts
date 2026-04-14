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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';

// Reusable booking schema for Swagger response bodies
const BOOKING_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'number', example: 1 },
    userId: { type: 'number', example: 2 },
    roomId: { type: 'number', example: 1 },
    checkIn: { type: 'string', example: '2025-06-01T14:00:00.000Z' },
    checkOut: { type: 'string', example: '2025-06-05T12:00:00.000Z' },
    status: { type: 'string', example: 'PENDING' },
    createdAt: { type: 'string', example: '2025-05-20T10:00:00.000Z' },
    user: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 2 },
        name: { type: 'string', example: 'John Doe' },
        email: { type: 'string', example: 'john@example.com' },
      },
    },
    room: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Deluxe Room 201' },
        pricePerNight: { type: 'number', example: 2800 },
      },
    },
  },
};

@ApiTags('bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class BookingsController {
  private readonly logger = new Logger(BookingsController.name);

  constructor(private readonly bookingsService: BookingsService) {}

  // FR-17, FR-18: any logged-in user can create a booking
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new booking — logged-in users only' })
  @ApiResponse({
    status: 201,
    description: 'Booking created successfully with PENDING status',
    schema: BOOKING_SCHEMA,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request — invalid dates, double booking, or inactive room',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  @ApiResponse({ status: 404, description: 'Room or user not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
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
  @ApiOperation({
    summary: 'Get bookings — admin sees all, user sees only their own',
  })
  @ApiResponse({
    status: 200,
    description: 'Bookings fetched successfully',
    schema: { type: 'array', items: BOOKING_SCHEMA },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  findAll(@CurrentUser() user: JwtUser) {
    this.logger.log(`Bookings list requested by ${user.role} #${user.id}`);
    return this.bookingsService.findAll(user.id, user.role);
  }

  // FR-24, FR-25: admin can see any booking, user can only see their own
  @Get(':id')
  @ApiOperation({
    summary:
      'Get a specific booking — admin sees any, user sees only their own',
  })
  @ApiParam({
    name: 'id',
    description: 'Numeric ID of the booking',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Booking found successfully',
    schema: BOOKING_SCHEMA,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — booking belongs to another user',
  })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    this.logger.log(
      `Booking #${id} details requested by ${user.role} #${user.id}`,
    );
    return this.bookingsService.findOne(id, user.id, user.role);
  }

  // FR-26: admin only — update booking status
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Update booking status — admin only (APPROVED, CANCELLED, PAID)',
  })
  @ApiParam({
    name: 'id',
    description: 'Numeric ID of the booking',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Booking status updated successfully',
    schema: BOOKING_SCHEMA,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request — booking is already cancelled or paid',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
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

  // Admin hard delete
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Permanently delete a booking — admin only' })
  @ApiParam({
    name: 'id',
    description: 'Numeric ID of the booking',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Booking deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Booking #1 has been deleted' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    this.logger.log(`Admin #${user.id} is deleting booking #${id}`);
    return this.bookingsService.remove(id, user.id);
  }
}
