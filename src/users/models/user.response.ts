import type { User, Attachment, Role, UserStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class AvatarDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  fileUrl: string;

  static fromAttachment(attachment: Attachment | null): AvatarDto | null {
    if (!attachment) return null;
    const dto = new AvatarDto();
    dto.id = attachment.id;
    dto.fileName = attachment.fileName;
    dto.fileUrl = attachment.fileUrl;
    return dto;
  }
}

export class UserResponse {
  id: string;

  email: string;

  fullName: string | null;

  status: UserStatus;

  role: Role;

  avatar?: {
    id: string;

    fileName: string;
    mimeType: string;
    originalFileName: string;
    fileUrl: string;

    createdAt: Date;
    updatedAt: Date;
  } | null;

  cover?: {
    id: string;

    fileName: string;
    mimeType: string;
    originalFileName: string;
    fileUrl: string;

    createdAt: Date;
    updatedAt: Date;
  } | null;

  dob: Date | null; // ISO Date

  verificationDate: Date | null; // ISO Date

  referenceId: string;

  isActive: boolean;

  static fromUserEntity(
    entity: User & { avatar?: Attachment | null; cover?: Attachment | null },
  ): UserResponse {
    const response = new UserResponse();
    response.id = entity.id;
    response.email = entity.email;
    response.fullName = entity.fullName;
    response.status = entity.status;
    response.role = entity.role;
    response.avatar = {
      id: entity.avatar?.id ?? '',
      fileName: entity.avatar?.fileName ?? '',
      mimeType: entity.avatar?.mimeType ?? '',
      originalFileName: entity.avatar?.originalFileName ?? '',
      fileUrl: entity.avatar?.fileUrl ?? '',
      createdAt: entity.avatar?.createdAt ?? new Date(),
      updatedAt: entity.avatar?.updatedAt ?? new Date(),
    };
    response.cover = {
      id: entity.cover?.id ?? '',
      fileName: entity.cover?.fileName ?? '',
      mimeType: entity.cover?.mimeType ?? '',
      originalFileName: entity.cover?.originalFileName ?? '',
      fileUrl: entity.cover?.fileUrl ?? '',
      createdAt: entity.cover?.createdAt ?? new Date(),
      updatedAt: entity.cover?.updatedAt ?? new Date(),
    };
    response.dob = entity.dob;
    response.verificationDate = entity.verificationDate;
    response.isActive = entity.isActive;
    response.referenceId = entity.referenceId;
    return response;
  }
}

export class UserReferenceResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ nullable: true })
  avatarUrl?: string | null;

  @ApiProperty()
  status: UserStatus;

  @ApiProperty()
  referenceId: string;

  @ApiProperty({ nullable: true })
  verificationDate?: Date | null;

  @ApiProperty()
  role: Role;

  static fromUserEntity(
    entity: User & { avatar?: Attachment | null },
  ): UserReferenceResponse {
    const response = new UserReferenceResponse();
    response.id = entity.id;
    response.fullName = entity.fullName;
    response.avatarUrl = entity.avatar?.fileUrl || null;
    response.status = entity.status;
    response.referenceId = entity.referenceId;
    response.verificationDate = entity.verificationDate;
    response.role = entity.role;
    return response;
  }
}

export class UserStatisticsResponse {
  createdAt: Date;
  referralsCount: number;
  postsCount: number;
  likesCount: number;
}
