import { IsEmail, IsEnum, IsString } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsEnum(['LEARNER','TEACHER'])
  role: 'LEARNER' | 'TEACHER';
}
