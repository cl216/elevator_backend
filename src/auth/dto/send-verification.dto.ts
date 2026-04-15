// src/auth/dto/send-verification.dto.ts
import { IsEmail } from 'class-validator';

export class SendVerificationDto {
  @IsEmail()
  email: string;
}