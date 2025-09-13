import { OriginSource } from '@prisma/client';
import { KiotVietAddressMapping } from './kiotviet-address-mapping.dto';

export class KiotVietWarehouseMapping {
  id: string;

  kiotVietWarehouseId?: number;

  name: string;
  email?: string;
  isActive?: boolean;
  source: OriginSource;

  address: KiotVietAddressMapping;

  createdAt: Date;
  updatedAt: Date;
}
