import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateUserAvatarDto {
  @ApiProperty({
    description: 'URL of the avatar image',
    example: 'https://example.com/avatar.jpg',
  })
  @IsString()
  avatarUrl: string;

  @ApiProperty({
    description: 'Original file name of the avatar image',
    example: 'profile_pic.jpg',
    required: false,
  })
  @IsString()
  originalFileName: string;
}
