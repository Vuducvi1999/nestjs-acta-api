import { KiotVietWarehouseMapping } from './kiotviet-warehouse-mapping.dto';

export class KiotVietAddressMapping {
  id: string;

  name: string;
  type: string;
  fullName: string;
  phone: string;

  street: string;
  ward?: string;
  district?: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;

  placeId?: string;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;

  isDefault: boolean;

  warehouse: KiotVietWarehouseMapping;

  createdAt: Date;
  updatedAt: Date;
}
