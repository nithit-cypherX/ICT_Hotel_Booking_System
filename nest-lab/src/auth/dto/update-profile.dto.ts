import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

// Only fields a user is allowed to update on their own profile.
// Role is intentionally excluded — users cannot promote themselves.
export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'New unique username',
    example: 'john_updated',
    type: String,
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    description: 'New email address',
    example: 'john_updated@example.com',
    type: String,
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiPropertyOptional({
    description: 'New display name',
    example: 'John Updated',
    type: String,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'New password — minimum 8 characters',
    example: 'newSecurePass123',
    type: String,
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password?: string;
}
