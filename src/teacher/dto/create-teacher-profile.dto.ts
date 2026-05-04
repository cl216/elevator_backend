import { IsArray, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";
export class CreateTeacherProfileDto {
  @IsString()
  @MaxLength(120)
  full_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

@IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gallery_image_urls?: string[];

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
