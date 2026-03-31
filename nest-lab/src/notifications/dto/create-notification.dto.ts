export class CreateNotificationDto {
  userId: number;
  bookingId: number;
  type: 'BOOKING_CREATED' | 'BOOKING_CANCELLED';
  message: string;
}