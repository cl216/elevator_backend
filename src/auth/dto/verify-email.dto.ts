// src/auth/dto/verify-email.dto.ts
import { IsString } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  token: string;
}