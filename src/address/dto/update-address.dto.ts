import {
  IsBoolean,
  IsOptional,
  IsString,
  IsIn,
  IsNumber,
} from 'class-validator';

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  name?: string; // Display name for the address

  @IsOptional()
  @IsString()
  @IsIn(['home', 'work', 'other'])
  type?: string; // Type: 'home', 'work', 'other'

  @IsOptional()
  @IsString()
  fullName?: string; // Full name of the recipient

  @IsOptional()
  @IsString()
  phone?: string; // Phone number

  @IsOptional()
  @IsString()
  street?: string; // Street address

  @IsOptional()
  @IsString()
  ward?: string; // Ward/Neighborhood (for detailed addressing)

  @IsOptional()
  @IsString()
  district?: string; // District (for detailed addressing)

  @IsOptional()
  @IsString()
  city?: string; // City

  @IsOptional()
  @IsString()
  state?: string; // State/Province (optional for international addresses)

  @IsOptional()
  @IsString()
  country?: string; // Country

  @IsOptional()
  @IsString()
  postalCode?: string; // Postal/ZIP code

  // Google Places API fields (for future implementation)
  @IsOptional()
  @IsString()
  placeId?: string; // Google Places ID

  @IsOptional()
  @IsNumber()
  latitude?: number; // Latitude coordinate

  @IsOptional()
  @IsNumber()
  longitude?: number; // Longitude coordinate

  @IsOptional()
  @IsString()
  formattedAddress?: string; // Google-formatted address

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
