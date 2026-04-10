import { IsEnum } from 'class-validator';

export class UpdateStatusDto {
  // Admin explicitly sets the booking to one of these states.
  // PENDING is excluded — a booking starts as PENDING and moves forward from there.
  @IsEnum(['APPROVED', 'CANCELLED', 'PAID'], {
    message: 'Status must be APPROVED, CANCELLED, or PAID',
  })
  status: 'APPROVED' | 'CANCELLED' | 'PAID';
}
