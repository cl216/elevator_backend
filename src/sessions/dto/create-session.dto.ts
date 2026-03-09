import {
  IsUUID,
  IsNumber,
  IsDateString,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class CreateSessionDto {
  @IsUUID()
  class_id: string;

  @IsDateString()
  start_time: string;

  @IsNumber()
  duration: number;

  @IsNumber()
  max_participants: number;

  @ArrayMaxSize(2)
  location: [number, number]; // [lng, lat]
}
