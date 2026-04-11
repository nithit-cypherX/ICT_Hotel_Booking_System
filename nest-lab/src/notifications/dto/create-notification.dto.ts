import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

// This DTO is used internally by BookingsService only.
// It is never exposed as a public API endpoint.
export class CreateNotificationDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  userId: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  bookingId: number;

  @IsEnum(['BOOKING_CREATED', 'BOOKING_CANCELLED'], {
    message: 'Type must be BOOKING_CREATED or BOOKING_CANCELLED',
  })
  type: 'BOOKING_CREATED' | 'BOOKING_CANCELLED';

  @IsString()
  @IsNotEmpty()
  message: string;
}
