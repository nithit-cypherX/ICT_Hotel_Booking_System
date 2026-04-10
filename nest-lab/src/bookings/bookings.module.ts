import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule], // gives BookingsService access to NotificationsService
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
