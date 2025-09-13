import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AddressResponse } from './models/address.response';

@Injectable()
export class AddressService {
  constructor(private readonly prisma: PrismaService) {}

  async getAddresses(userId: string): Promise<AddressResponse[]> {
    const addresses = await this.prisma.address.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    });
    return addresses.map(AddressResponse.fromEntity);
  }

  async createAddress(userId: string, dto: CreateAddressDto): Promise<AddressResponse> {
    // Check if this is the first address for the user
    const existingAddresses = await this.prisma.address.count({
      where: { userId },
    });
    
    // If this is the first address, set it as default
    const isFirstAddress = existingAddresses === 0;
    const isDefault = isFirstAddress ? true : (dto.isDefault || false);
    
    if (isDefault) {
      // Unset previous default addresses
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    
    const address = await this.prisma.address.create({
      data: { ...dto, userId, isDefault },
    });
    return AddressResponse.fromEntity(address);
  }

  async updateAddress(userId: string, id: string, dto: UpdateAddressDto): Promise<AddressResponse> {
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address) throw new NotFoundException('Address not found');
    if (address.userId !== userId) throw new ForbiddenException('Not allowed');
    
    // If trying to set as default
    if (dto.isDefault === true) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    
    const updated = await this.prisma.address.update({
      where: { id },
      data: dto,
    });
    
    return AddressResponse.fromEntity(updated);
  }

  async deleteAddress(userId: string, id: string): Promise<void> {
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address) throw new NotFoundException('Address not found');
    if (address.userId !== userId) throw new ForbiddenException('Not allowed');
    
    // Check if this is the default address
    const isDefaultAddress = address.isDefault;
    
    // Count total addresses for this user
    const totalAddresses = await this.prisma.address.count({
      where: { userId },
    });
    
    // If this is the only address, prevent deletion
    if (totalAddresses === 1) {
      throw new ForbiddenException('Cannot delete the only address. At least one address is required.');
    }
    
    // If deleting the default address, set the first remaining address as default
    if (isDefaultAddress) {
      const nextAddress = await this.prisma.address.findFirst({
        where: { userId, id: { not: id } },
        orderBy: { createdAt: 'asc' },
      });
      
      if (nextAddress) {
        await this.prisma.address.update({
          where: { id: nextAddress.id },
          data: { isDefault: true },
        });
      }
    }
    
    await this.prisma.address.delete({ where: { id } });
  }

  async setDefaultAddress(userId: string, id: string): Promise<AddressResponse> {
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address) throw new NotFoundException('Address not found');
    if (address.userId !== userId) throw new ForbiddenException('Not allowed');
    
    // Unset all other default addresses for this user
    const unsetResult = await this.prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
    
    // Set this address as default
    const updated = await this.prisma.address.update({
      where: { id },
      data: { isDefault: true },
    });
    
    return AddressResponse.fromEntity(updated);
  }

  async getDefaultAddress(userId: string): Promise<AddressResponse | null> {
    const defaultAddress = await this.prisma.address.findFirst({
      where: { userId, isDefault: true },
      orderBy: { createdAt: 'asc' },
    });
    
    return defaultAddress ? AddressResponse.fromEntity(defaultAddress) : null;
  }

  async getAddressesList(userId: string): Promise<{
    addresses: AddressResponse[];
    defaultAddressId: string | null;
  }> {
    const addresses = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' }
      ],
    });
    
    const defaultAddress = addresses.find(addr => addr.isDefault);
    
    return {
      addresses: addresses.map(AddressResponse.fromEntity),
      defaultAddressId: defaultAddress?.id || null,
    };
  }
} 