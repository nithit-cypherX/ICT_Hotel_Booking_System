import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

// Only fields a user is allowed to update on their own profile.
// Role is intentionally excluded — users cannot promote themselves.
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password?: string;
}
