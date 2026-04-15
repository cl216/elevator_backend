import { IsString, MaxLength, MinLength } from 'class-validator';

export class ProposeCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label: string;
}