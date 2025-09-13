import { Address } from '@prisma/client';

export class AddressResponse {
  id: string;

  // Basic address information
  name: string; // Display name for the address
  type: string; // Type: 'home', 'work', 'other'
  fullName: string; // Full name of the recipient
  phone: string; // Phone number

  // Address components
  street: string; // Street address
  ward?: string | null; // Ward/Neighborhood (for detailed addressing)
  district?: string | null; // District (for detailed addressing)
  city: string; // City
  state?: string | null; // State/Province (optional for international addresses)
  country: string; // Country
  postalCode?: string | null; // Postal/ZIP code

  // Google Places API fields (for future implementation)
  placeId?: string | null; // Google Places ID
  latitude?: number | null; // Latitude coordinate
  longitude?: number | null; // Longitude coordinate
  formattedAddress?: string | null; // Google-formatted address

  // User settings
  isDefault: boolean;
  userId: string | null;

  createdAt: Date;
  updatedAt: Date;

  static fromEntity(address: Address): AddressResponse {
    return {
      id: address.id,
      name: address.name,
      type: address.type,
      fullName: address.fullName,
      phone: address.phone,
      street: address.street,
      ward: address.ward,
      district: address.district,
      city: address.city,
      state: address.state,
      country: address.country,
      postalCode: address.postalCode,
      placeId: address.placeId,
      latitude: address.latitude,
      longitude: address.longitude,
      formattedAddress: address.formattedAddress,
      isDefault: address.isDefault,
      userId: address.userId,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }
}
