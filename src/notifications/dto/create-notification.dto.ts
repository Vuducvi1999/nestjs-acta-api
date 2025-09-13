import { NotificationAction, RelatedModel } from '@prisma/client';
import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsEnum(RelatedModel)
  relatedModel: RelatedModel;

  @IsString()
  @IsNotEmpty()
  relatedModelId: string;

  @IsEnum(NotificationAction)
  action: NotificationAction;

  @IsString()
  @IsNotEmpty()
  message: string;
}
