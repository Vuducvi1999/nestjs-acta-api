import { IsOptional, IsString } from 'class-validator';

export class CreateDocumentCategoryDto {
  @IsString()
  name: string;

  @IsString()
  description?: string;
}

export class CreateDocumentChapterDto {
  @IsString()
  title: string;
}

export class CreateDocumentDto {
  @IsString()
  title: string;

  @IsString()
  description?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  categoryId: string;
}
