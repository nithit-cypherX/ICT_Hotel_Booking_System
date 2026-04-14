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
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// Reusable room schema for Swagger response bodies
const ROOM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'number', example: 1 },
    name: { type: 'string', example: 'Deluxe Room 201' },
    description: {
      type: 'string',
      example: 'Deluxe room with city view and balcony',
    },
    capacity: { type: 'number', example: 2 },
    pricePerNight: { type: 'number', example: 2800 },
    imageUrl: { type: 'string', example: '/images/room201.jpg' },
    isActive: { type: 'boolean', example: true },
    createdAt: { type: 'string', example: '2025-06-01T10:00:00.000Z' },
    updatedAt: { type: 'string', example: '2025-06-01T10:00:00.000Z' },
  },
};

@ApiTags('rooms')
@Controller('rooms')
// Cache all GET responses in this controller — served from Redis after first request
@UseInterceptors(CacheInterceptor)
// Override global 30 req/min — rooms are DB-heavy so we allow more but still protect
@Throttle({ default: { limit: 100, ttl: 60000 } })
export class RoomsController {
  private readonly logger = new Logger(RoomsController.name);

  constructor(private readonly roomsService: RoomsService) {}

  // FR-8: admin only — create a new room
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new room - Admin only' })
  @ApiResponse({
    status: 201,
    description: 'Room created successfully',
    schema: ROOM_SCHEMA,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or Invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin only',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
  })
  create(@Body() createRoomDto: CreateRoomDto) {
    this.logger.log(`Admin is creating a new room: ${createRoomDto.name}`);
    return this.roomsService.create(createRoomDto);
  }

  // IMPORTANT: /search must be declared before /:id
  // otherwise NestJS treats the literal word "search" as an id param

  // FR-27, FR-28, FR-29: public — guests can search available rooms
  // CacheInterceptor caches this response automatically (GET route)
  @Get('search')
  @ApiOperation({
    summary: 'Search available rooms by date range and optional capacity',
  })
  @ApiQuery({
    name: 'checkIn',
    required: true,
    type: String,
    description: 'Check-in date (ISO 8601)',
    example: '2025-06-01T14:00:00.000Z',
  })
  @ApiQuery({
    name: 'checkOut',
    required: true,
    type: String,
    description: 'Check-out date (ISO 8601)',
    example: '2025-06-05T12:00:00.000Z',
  })
  @ApiQuery({
    name: 'capacity',
    required: false,
    type: Number,
    description: 'Minimum guest capacity',
    example: 2,
  })
  @ApiResponse({
    status: 200,
    description: 'Available rooms for the selected dates',
    schema: { type: 'array', items: ROOM_SCHEMA },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request — invalid or missing dates',
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  search(
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
    @Query('capacity') capacity?: string,
  ) {
    this.logger.log(
      `Room search requested — checkIn: ${checkIn}, checkOut: ${checkOut}, capacity: ${capacity ?? 'any'}`,
    );
    return this.roomsService.searchAvailable(
      checkIn,
      checkOut,
      capacity ? +capacity : undefined,
    );
  }

  // FR-12: public — guests can view the list of active rooms
  // CacheInterceptor caches this response automatically (GET route)
  @Get()
  @ApiOperation({ summary: 'Get all rooms' })
  @ApiResponse({
    status: 200,
    description: 'Active rooms fetched successfully',
    schema: { type: 'array', items: ROOM_SCHEMA },
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
  })
  findAll() {
    this.logger.log('Fetching all active rooms');
    return this.roomsService.findAll();
  }

  // FR-13: public — guests can view a specific room's details
  // CacheInterceptor caches this response automatically (GET route)
  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific room by ID' })
  @ApiParam({ name: 'id', description: 'Numeric ID of the room', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Room found successfully',
    schema: ROOM_SCHEMA,
  })
  @ApiResponse({
    status: 404,
    description: 'Room not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Fetching details for room ID: ${id}`);
    return this.roomsService.findOne(id);
  }

  // FR-9: admin only — update room details
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update room details - Admin only' })
  @ApiParam({ name: 'id', description: 'Numeric ID of the room', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Room updated successfully',
    schema: ROOM_SCHEMA,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Validation failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or Invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin only',
  })
  @ApiResponse({
    status: 404,
    description: 'Room not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoomDto: UpdateRoomDto,
  ) {
    this.logger.log(`Admin is updating room ID: ${id}`);
    return this.roomsService.update(id, updateRoomDto);
  }

  // FR-10: admin only — soft deactivate a room (hides from public listing)
  @Patch(':id/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Deactivate a room - Admin only (soft delete, hides from public listing',
  })
  @ApiParam({ name: 'id', description: 'Numeric ID of the room', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Room deactivated successfully',
    schema: ROOM_SCHEMA,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — admin only',
  })
  @ApiResponse({
    status: 404,
    description: 'Room not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
  })
  disable(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Admin is disabling room ID: ${id}`);
    return this.roomsService.disable(id);
  }

  // FR-10: admin only — re-activate a previously disabled room
  @Patch(':id/enable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Re-activate a deactivated room — Admin only' })
  @ApiParam({ name: 'id', description: 'Numeric ID of the room', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Room activated successfully',
    schema: ROOM_SCHEMA,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — Missing or Invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — Admin only',
  })
  @ApiResponse({
    status: 404,
    description: 'Room not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
  })
  enable(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Admin is enabling room ID: ${id}`);
    return this.roomsService.enable(id);
  }

  // FR-10: admin only — hard delete a room
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Permanently delete a room — Admin only' })
  @ApiParam({ name: 'id', description: 'Numeric ID of the room', type: Number })
  @ApiResponse({ status: 200, description: 'Room deleted successfully' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — Missing or Invalid token',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — Admin only' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Admin is deleting room ID: ${id}`);
    return this.roomsService.remove(id);
  }
}
