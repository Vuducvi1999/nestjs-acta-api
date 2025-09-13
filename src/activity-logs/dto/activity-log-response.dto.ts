import { ActivityTargetType, ActivityType } from '@prisma/client';

export class ActivityLogResponseDto {
  id: string;

  targetId: string;

  targetType: ActivityTargetType;

  activityType: ActivityType;

  uploaderId: string;

  description?: string;

  changes?: Record<string, any>;

  createdAt: Date;

  updatedAt: Date;

  uploader?: {
    id: string;
    fullName: string;
    email: string;
    avatar: string;
    role: string;
    status: string;
  };

  constructor(partial: Partial<ActivityLogResponseDto>) {
    Object.assign(this, partial);
  }

  static fromDocument(data: any): ActivityLogResponseDto {
    return new ActivityLogResponseDto({
      id: data.id,
      targetId: data.targetId,
      targetType: data.targetType,
      activityType: data.activityType,
      uploaderId: data.uploaderId,
      description: data.description,
      changes: data.changes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      uploader: data.uploader
        ? {
            id: data.uploader.id,
            fullName: data.uploader.fullName,
            email: data.uploader.email,
            avatar: data.uploader.avatar,
            role: data.uploader.role,
            status: data.uploader.status,
          }
        : undefined,
    });
  }
}

export class PaginatedActivityLogResponseDto {
  data: ActivityLogResponseDto[];

  total: number;

  page: number;

  limit: number;

  totalPages: number;

  hasNext: boolean;

  hasPrev: boolean;

  static fromPaginatedResult(result: {
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }): PaginatedActivityLogResponseDto {
    const response = new PaginatedActivityLogResponseDto();
    response.data = result.data;
    response.total = result.total;
    response.page = result.page;
    response.limit = result.limit;
    response.totalPages = result.totalPages;
    response.hasNext = result.page < result.totalPages;
    response.hasPrev = result.page > 1;
    return response;
  }
}
