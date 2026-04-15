import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsInt,
  Min,
} from 'class-validator';

export class CreateTeacherSessionDto {
  @IsString()
  title: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0.01)
  price: number;

  @IsOptional()
  @IsString()
  image_url_1?: string;

  @IsOptional()
  @IsString()
  image_url_2?: string;

  @IsOptional()
  @IsString()
  image_url_3?: string;

  @IsDateString()
  start_time: string;

  @IsInt()
  @Min(1)
  duration: number;

  @IsInt()
  @Min(1)
  max_participants: number;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsOptional()
  @IsString()
  rough_location?: string;

  @IsOptional()
  @IsString()
  arrival_instructions?: string;
}