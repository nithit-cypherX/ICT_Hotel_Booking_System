import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRoomDto {
  @ApiProperty({
    description: 'Name of the room',
    example: 'Deluxe Room 201',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Optional description of the room',
    example: 'Deluxe room with city view and balcony',
    type: String,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Maximum number of guests the room can accommodate',
    example: 2,
    type: Number,
    minimum: 1,
  })
  @IsNumber()
  @Min(1, { message: 'Capacity must be at least 1' })
  @Type(() => Number)
  capacity!: number;

  @ApiProperty({
    description: 'Price per night in Thai Baht',
    example: 2800,
    type: Number,
    minimum: 0,
  })
  @IsNumber()
  @Min(0, { message: 'Price per night cannot be negative' })
  @Type(() => Number)
  pricePerNight!: number;

  @ApiPropertyOptional({
    description: 'URL path to the room image',
    example: '/images/room201.jpg',
    type: String,
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Whether the room is available for booking — defaults to true',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
