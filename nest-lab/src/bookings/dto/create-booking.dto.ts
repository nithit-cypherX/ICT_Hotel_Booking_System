import { IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

// userId is intentionally excluded — it comes from the JWT token, not the request body.
// status is intentionally excluded — the service always forces PENDING on create.
export class CreateBookingDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  roomId: number;

  @IsDateString({}, { message: 'checkIn must be a valid ISO 8601 date string' })
  checkIn: string;

  @IsDateString(
    {},
    { message: 'checkOut must be a valid ISO 8601 date string' },
  )
  checkOut: string;
}
