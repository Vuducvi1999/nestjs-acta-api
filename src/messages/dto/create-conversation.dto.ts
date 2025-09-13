import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  isGroup?: boolean;

  @IsArray()
  @IsUUID('4', { each: true })
  memberIds: string[];
}
