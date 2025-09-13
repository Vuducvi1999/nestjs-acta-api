import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class ToggleConversationVisibilityDto {
  @ApiProperty({
    description: 'Conversation ID to toggle visibility',
    example: 'uuid-string',
  })
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @ApiProperty({
    description: 'Whether to hide (true) or show (false) the conversation',
    example: true,
  })
  @IsBoolean()
  isHidden: boolean;
}
