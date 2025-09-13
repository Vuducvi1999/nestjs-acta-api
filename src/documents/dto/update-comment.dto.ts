import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateDocumentCommentDto {
  @ApiProperty({ description: 'Updated comment content' })
  @IsNotEmpty()
  @IsString()
  content: string;
}
