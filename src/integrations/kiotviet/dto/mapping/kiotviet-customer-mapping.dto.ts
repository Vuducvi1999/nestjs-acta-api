import { OriginSource } from '@prisma/client';
import { KiotVietUserMapping } from './kiotviet-user-mapping.dto';

export class KiotVietCustomerMapping {
  id: string;

  kiotVietCustomerId?: number;
  kiotVietCustomerCode?: string;

  taxCode?: string;
  comments?: string;
  source: OriginSource;

  rewardPoint?: number;
  psidFacebook?: number;

  user?: KiotVietUserMapping;

  customerGroup?: KiotVietCustomerGroupMapping;

  createdAt: Date;
  updatedAt: Date;
}

export class KiotVietCustomerGroupMapping {
  id: string;

  kiotVietCustomerGroupId?: number;

  name: string;

  customers: KiotVietCustomerMapping[];

  createdAt: Date;
  updatedAt: Date;
}
