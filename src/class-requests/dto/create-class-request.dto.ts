import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateClassRequestDto {
  @IsIn(['existing_category', 'new_class'])
  request_type: 'existing_category' | 'new_class';

  @ValidateIf((o) => o.request_type === 'existing_category')
  @IsIn(['art', 'music', 'cooking', 'language', 'crafts'])
  category?: string;

  @ValidateIf((o) => o.request_type === 'new_class')
  @IsString()
  @MaxLength(80)
  custom_title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}