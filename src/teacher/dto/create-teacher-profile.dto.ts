import { IsString, IsOptional } from 'class-validator';

export class CreateTeacherProfileDto {
  @IsString()
  full_name: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  image_url?: string;
}
