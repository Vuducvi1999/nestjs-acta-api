import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../users/users.decorator';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AddressResponse } from './models/address.response';
import { JwtPayload } from '../auth/jwt-payload';

@ApiBearerAuth()
@ApiTags('Address')
@UseGuards(JwtAuthGuard)
@Controller('address')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Get('default')
  async getDefaultAddress(@CurrentUser() user: JwtPayload): Promise<AddressResponse | null> {
    return this.addressService.getDefaultAddress(user.id);
  }

  @Get('list')
  async getAddressesList(@CurrentUser() user: JwtPayload): Promise<{
    addresses: AddressResponse[];
    defaultAddressId: string | null;
  }> {
    return this.addressService.getAddressesList(user.id);
  }

  @Get()
  async getAddresses(@CurrentUser() user: JwtPayload): Promise<AddressResponse[]> {
    return this.addressService.getAddresses(user.id);
  }

  @Post()
  async createAddress(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAddressDto,
  ): Promise<AddressResponse> {
    return this.addressService.createAddress(user.id, dto);
  }

  @Patch(':id/set-default')
  async setDefaultAddress(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<AddressResponse> {
    console.log('Setting default address for user:', user.id, 'address:', id);
    const result = await this.addressService.setDefaultAddress(user.id, id);
    console.log('Default address set successfully:', result.id);
    return result;
  }

  @Patch(':id')
  async updateAddress(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<AddressResponse> {
    return this.addressService.updateAddress(user.id, id, dto);
  }

  @Delete(':id')
  async deleteAddress(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.addressService.deleteAddress(user.id, id);
    return { success: true };
  }
} 