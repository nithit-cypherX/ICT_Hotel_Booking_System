import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

// userId is intentionally excluded — it comes from the JWT token, not the request body.
// status is intentionally excluded — the service always forces PENDING on create.
export class CreateBookingDto {
  @ApiProperty({
    description: 'ID of the room to book',
    example: 1,
    type: Number,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  roomId: number;

  @ApiProperty({
    description: 'Check-in date and time in ISO 8601 format',
    example: '2025-06-01T14:00:00.000Z',
    type: String,
  })
  @IsDateString({}, { message: 'checkIn must be a valid ISO 8601 date string' })
  checkIn: string;

  @ApiProperty({
    description: 'Check-out date and time in ISO 8601 format',
    example: '2025-06-05T12:00:00.000Z',
    type: String,
  })
  @IsDateString(
    {},
    { message: 'checkOut must be a valid ISO 8601 date string' },
  )
  checkOut: string;
}
