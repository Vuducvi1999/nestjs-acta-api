import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  IsNumber,
} from 'class-validator';

export class CreateAddressDto {
  @IsNotEmpty()
  @IsString()
  name: string; // Display name for the address

  @IsNotEmpty()
  @IsString()
  @IsIn(['home', 'work', 'other'])
  type: string; // Type: 'home', 'work', 'other'

  @IsNotEmpty()
  @IsString()
  fullName: string; // Full name of the recipient

  @IsNotEmpty()
  @IsString()
  phone: string; // Phone number

  @IsNotEmpty()
  @IsString()
  street: string; // Street address

  @IsOptional()
  @IsString()
  ward?: string; // Ward/Neighborhood (for detailed addressing)

  @IsOptional()
  @IsString()
  district?: string; // District (for detailed addressing)

  @IsNotEmpty()
  @IsString()
  city: string; // City

  @IsOptional()
  @IsString()
  state?: string; // State/Province (optional for international addresses)

  @IsNotEmpty()
  @IsString()
  country: string; // Country

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
