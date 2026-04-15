import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateClassDto {
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
}