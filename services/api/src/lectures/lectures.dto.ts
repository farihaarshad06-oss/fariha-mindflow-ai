import { IsOptional, IsString, IsBoolean, IsUUID, MaxLength } from 'class-validator';

export class CreateLectureDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsBoolean()
  consentAcknowledged: boolean;
}
