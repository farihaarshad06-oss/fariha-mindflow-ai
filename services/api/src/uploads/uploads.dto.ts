import {
  IsEnum,
  IsString,
  IsInt,
  IsOptional,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { FILE_LIMITS } from '@mindflow/config';

export class UploadRequestDto {
  @IsEnum(['LECTURE_AUDIO', 'COURSE_DOCUMENT'])
  purpose: 'LECTURE_AUDIO' | 'COURSE_DOCUMENT';

  @IsString()
  @MaxLength(255)
  fileName: string;

  @IsString()
  mimeType: string;

  @IsInt()
  @Min(1)
  @Max(FILE_LIMITS.maxUploadBytes)
  fileSize: number;
}
