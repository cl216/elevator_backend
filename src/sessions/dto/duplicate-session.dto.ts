import { IsDateString } from 'class-validator';

export class DuplicateSessionDto {
  @IsDateString()
  start_time: string;
}
