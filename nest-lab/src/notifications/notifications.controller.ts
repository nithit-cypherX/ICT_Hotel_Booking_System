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
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';

// All notification routes require a valid JWT — no public access
// Notifications are system-generated internally by BookingsService.
// This controller only exposes read operations and mark-as-read.
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  // FR-30, FR-31: admin gets all notifications, user gets only their own
  @Get()
  findAll(@CurrentUser() user: JwtUser) {
    this.logger.log(`Notifications list requested by ${user.role} #${user.id}`);
    return this.notificationsService.findAll(user.id, user.role);
  }

  // User can only fetch their own notification — admin can fetch any
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    this.logger.log(
      `Notification #${id} details requested by ${user.role} #${user.id}`,
    );
    return this.notificationsService.findOne(id, user.id, user.role);
  }

  // Mark a notification as read — ownership is verified inside the service
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
  ) {
    this.logger.log(`User #${user.id} marking notification #${id} as read`);
    return this.notificationsService.markAsRead(id, user.id, user.role);
  }
}
