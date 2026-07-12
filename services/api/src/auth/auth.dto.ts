import { IsEmail, IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ROLES } from '@mindflow/types'; // Fixed: from types

export class RegisterDto {
  @IsEmail()
  email?: string; // optional for type-checking
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string; // optional

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string; // optional

  @IsOptional()
  role?: (typeof ROLES)[number];
}

export class LoginDto {
  @IsEmail()
  email?: string; // optional
  @IsString()
  @MinLength(1)
  password?: string; // optional
}
