import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

// This DTO is used internally by BookingsService only.
// It is never exposed as a public API endpoint.
export class CreateNotificationDto {
  @ApiProperty({
    description: 'ID of the user who receives the notification',
    example: 2,
    type: Number,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  userId: number;

  @ApiProperty({
    description: 'ID of the booking this notification relates to',
    example: 1,
    type: Number,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  bookingId: number;

  @ApiProperty({
    description: 'Event type that triggered the notification',
    example: 'BOOKING_CREATED',
    enum: ['BOOKING_CREATED', 'BOOKING_CANCELLED'],
  })
  @IsEnum(['BOOKING_CREATED', 'BOOKING_CANCELLED'], {
    message: 'Type must be BOOKING_CREATED or BOOKING_CANCELLED',
  })
  type: 'BOOKING_CREATED' | 'BOOKING_CANCELLED';

  @ApiProperty({
    description: 'Human-readable notification message for the frontend',
    example: 'Your booking for "Deluxe Room 201" is pending approval.',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}
