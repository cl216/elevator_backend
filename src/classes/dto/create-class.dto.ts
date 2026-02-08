import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateClassDto {
  @IsString()
  title: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  price: number;
}
