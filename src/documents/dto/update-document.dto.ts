import { PartialType } from '@nestjs/swagger';
import {
  CreateDocumentChapterDto,
  CreateDocumentDto,
} from './create-document.dto';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateDocumentChapterDto extends PartialType(
  CreateDocumentChapterDto,
) {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsNumber()
  views: number;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;
}

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  downloads?: number;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;
}
