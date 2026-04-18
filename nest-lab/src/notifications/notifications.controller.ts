import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';

// Reusable notification schema for Swagger response bodies
const NOTIFICATION_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'number', example: 1 },
    userId: { type: 'number', example: 2 },
    bookingId: { type: 'number', example: 1 },
    type: { type: 'string', example: 'BOOKING_CREATED' },
    message: {
      type: 'string',
      example: 'Your booking for "Deluxe Room 201" is pending approval.',
    },
    isRead: { type: 'boolean', example: false },
    createdAt: { type: 'string', example: '2025-05-20T10:00:00.000Z' },
  },
};

// All notification routes require a valid JWT — no public access.
// Notifications are system-generated internally by BookingsService.
// This controller only exposes read operations and mark-as-read.
@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  // FR-30, FR-31: admin gets all notifications, user gets only their own
  @Get()
  @ApiOperation({
    summary: 'Get notifications — admin sees all, user sees only their own',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications fetched successfully',
    schema: { type: 'array', items: NOTIFICATION_SCHEMA },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  findAll(@CurrentUser() user: JwtUser) {
    this.logger.log(`Notifications list requested by ${user.role} #${user.id}`);
    return this.notificationsService.findAll(user.id, user.role);
  }

  // User can only fetch their own notification — admin can fetch any
  @Get(':id')
  @ApiOperation({
    summary:
      'Get a specific notification — admin sees any, user sees only their own',
  })
  @ApiParam({
    name: 'id',
    description: 'Numeric ID of the notification',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Notification found successfully',
    schema: NOTIFICATION_SCHEMA,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — notification belongs to another user',
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    this.logger.log(
      `Notification #${id} details requested by ${user.role} #${user.id}`,
    );
    return this.notificationsService.findOne(id, user.id, user.role);
  }

  // Mark a notification as read — ownership is verified inside the service
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read — must be the owner' })
  @ApiParam({
    name: 'id',
    description: 'Numeric ID of the notification',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    schema: NOTIFICATION_SCHEMA,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — notification belongs to another user',
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
  ) {
    this.logger.log(`User #${user.id} marking notification #${id} as read`);
    return this.notificationsService.markAsRead(id, user.id, user.role);
  }
}
