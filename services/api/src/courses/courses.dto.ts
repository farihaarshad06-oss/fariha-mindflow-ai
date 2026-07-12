import { IsOptional, IsString, IsISO8601, MaxLength } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @MaxLength(160)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @IsOptional()
  @IsISO8601()
  nextExamDate?: string;
}
