import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}