import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class UpdateStatusDto {
  @ApiProperty({
    description:
      'New status for the booking — admin moves it forward from PENDING',
    example: 'APPROVED',
    enum: ['APPROVED', 'CANCELLED', 'PAID'],
  })
  // PENDING is excluded — a booking starts as PENDING and moves forward from there
  @IsEnum(['APPROVED', 'CANCELLED', 'PAID'], {
    message: 'Status must be APPROVED, CANCELLED, or PAID',
  })
  status!: 'APPROVED' | 'CANCELLED' | 'PAID';
}
