import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  sessionId: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  introMessage?: string;
}
