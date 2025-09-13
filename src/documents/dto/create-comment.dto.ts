import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDocumentCommentDto {
  @ApiProperty({ description: 'Comment content' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({
    description: 'Parent comment ID for replies',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
