import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Called internally by BookingsService only — not exposed as an endpoint
  async create(createNotificationDto: CreateNotificationDto) {
    try {
      const notification = await this.prisma.notification.create({
        data: createNotificationDto,
      });
      this.logger.log(
        `Notification created — type: ${notification.type}, user #${notification.userId}, booking #${notification.bookingId}`,
      );
      return notification;
    } catch (error) {
      this.logger.error(`Failed to create notification: ${error.message}`);
      throw error;
    }
  }

  // FR-30, FR-31: admin sees all notifications, user sees only their own
  async findAll(userId: number, role: Role) {
    if (role === Role.ADMIN) {
      const notifications = await this.prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
      });
      this.logger.log(
        `Admin #${userId} fetched all notifications — count: ${notifications.length}`,
      );
      return notifications;
    }

    // Regular user — return only their own notifications
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    this.logger.log(
      `User #${userId} fetched their own notifications — count: ${notifications.length}`,
    );
    return notifications;
  }

  // User can only fetch their own notification — admin can fetch any
  async findOne(notificationId: number, userId: number, role: Role) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      this.logger.error(
        `Validation failed: Notification #${notificationId} does not exist`,
      );
      throw new NotFoundException(`Notification #${notificationId} not found`);
    }

    // Regular users cannot view notifications that belong to someone else
    if (role !== Role.ADMIN && notification.userId !== userId) {
      this.logger.error(
        `Access denied: User #${userId} tried to access notification #${notificationId} owned by user #${notification.userId}`,
      );
      throw new ForbiddenException(
        'You do not have permission to view this notification',
      );
    }

    this.logger.log(
      `Notification #${notificationId} fetched by ${role === Role.ADMIN ? 'admin' : 'user'} #${userId}`,
    );
    return notification;
  }

  // Mark a notification as read — only the owner can do this
  async markAsRead(notificationId: number, userId: number, role: Role) {
    try {
      // Reuse findOne — it handles 404 and ownership check in one call
      await this.findOne(notificationId, userId, role);

      const updated = await this.prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });

      this.logger.log(
        `Notification #${notificationId} marked as read by user #${userId}`,
      );
      return updated;
    } catch (error) {
      this.logger.error(
        `Failed to mark notification #${notificationId} as read: ${error.message}`,
      );
      throw error;
    }
  }
}
