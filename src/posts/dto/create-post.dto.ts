import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

@ValidatorConstraint({ name: 'atLeastOneField', async: false })
class AtLeastOneFieldConstraint implements ValidatorConstraintInterface {
  validate(_: any, args: ValidationArguments) {
    const obj = args.object as any;
    return (
      (obj.content && obj.content.trim() !== '') ||
      (Array.isArray(obj.imageUrls) && obj.imageUrls.length > 0) ||
      (Array.isArray(obj.videoUrls) && obj.videoUrls.length > 0)
    );
  }

  defaultMessage(_: ValidationArguments) {
    return 'To create a post, please include at least one of the following: some text, one or more images, or one or more videos.';
  }
}

export class CreatePostLocationDto {
  @IsString()
  address: string;
}

export class CreatePostDto {
  @IsOptional()
  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  imageUrls?: string[];

  @IsOptional()
  @IsArray()
  videoUrls?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePostLocationDto)
  location?: CreatePostLocationDto;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  taggedUserIds?: string[];

  @IsOptional()
  @IsUUID('4')
  feelingId?: string;

  @IsOptional()
  @IsUUID('4')
  activityId?: string;

  @Validate(AtLeastOneFieldConstraint)
  _atLeastOneFieldCheck: boolean; // Dummy field to trigger validator
}
