import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  // Accepts either a username or an email address
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}
