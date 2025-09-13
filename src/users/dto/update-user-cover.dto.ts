import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateUserCoverDto {
  @ApiProperty({
    description: 'URL of the cover image',
    example: 'https://example.com/cover.jpg',
  })
  @IsString()
  coverUrl: string;

  @ApiProperty({
    description: 'Original file name of the cover image',
    example: 'cover_pic.jpg',
    required: false,
  })
  @IsString()
  originalFileName: string;
}
