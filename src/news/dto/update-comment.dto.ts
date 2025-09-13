import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateNewsCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
