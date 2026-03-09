import { IsString, IsOptional, MaxLength, IsUrl } from 'class-validator';

export class CreateTeacherProfileDto {
  @IsString()
  @MaxLength(120)
  full_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsUrl()
  image_url?: string;
}
