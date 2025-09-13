import { Controller, Get, HttpStatus, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PublicBusinessService } from './public-business.service';
import { PublicBrandDetailDto } from '../products/dto/public-product-response.dto';

@ApiTags('Public Business')
@Public()
@Controller('public/business')
export class PublicBusinessController {
  constructor(private readonly service: PublicBusinessService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get public business (brand) by ID' })
  @ApiParam({ name: 'id', description: 'Business ID' })
  @ApiResponse({ status: HttpStatus.OK, type: PublicBrandDetailDto })
  async findById(@Param('id') id: string): Promise<PublicBrandDetailDto> {
    return this.service.getBrandDetail(id);
  }
}
