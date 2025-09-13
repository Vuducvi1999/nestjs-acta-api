import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreateKYCDto {
  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    description: 'Date of birth of the user',
    example: '1990-01-01',
  })
  @IsDateString()
  @IsNotEmpty()
  dateOfBirth: string;

  @ApiProperty({
    description: 'Nationality of the user',
    example: 'Vietnam',
  })
  @IsString()
  @IsNotEmpty()
  nationality: string;

  @ApiProperty({
    description: 'Address of the user',
    example: '123 Main St, Anytown, USA',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: 'KYC number/ID number of the user',
    example: '1234567890',
  })
  @IsString()
  @IsNotEmpty()
  kycNumber: string;

  @ApiProperty({
    description: 'KYC file URL',
    example: 'https://example.com/file.jpg',
  })
  @IsString()
  @IsOptional()
  kycFileUrl?: string;
}
