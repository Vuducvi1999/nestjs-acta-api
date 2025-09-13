import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateNewsCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  parentCommentId?: string;
}
