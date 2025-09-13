import { Gender, OriginSource, Role, UserStatus } from '@prisma/client';

export class KiotVietUserMapping {
  id: string;

  kiotVietUserId?: number;

  email: string;
  fullName: string;
  referenceId: string;
  phoneNumber: string;
  dob?: Date;
  gender: Gender;
  verificationDate?: Date;
  role: Role;
  status: UserStatus;
  source: OriginSource;

  createdAt: Date;
  updatedAt: Date;
}
