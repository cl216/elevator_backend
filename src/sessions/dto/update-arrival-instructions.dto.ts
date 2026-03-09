import { IsString, MaxLength } from 'class-validator';

export class UpdateArrivalInstructionsDto {
  @IsString()
  @MaxLength(300)
  arrival_instructions: string;
}
