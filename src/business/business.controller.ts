import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import {
  CreateBusinessDto,
  UpdateBusinessDto,
  BusinessResponseDto,
} from './dto';

@ApiTags('Business')
@Controller('business')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all businesses',
    description: 'Retrieve all active businesses with their basic information',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Businesses retrieved successfully',
    type: [BusinessResponseDto],
  })
  async findAll(): Promise<BusinessResponseDto[]> {
    return this.businessService.findAll();
  }

  @Get('slug/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get business by slug',
    description: 'Retrieve a business by its slug',
  })
  @ApiParam({
    name: 'slug',
    description: 'Business slug',
    example: 'cong-ty-tnhh-abc',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Business retrieved successfully',
    type: BusinessResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Business not found',
  })
  async findBySlug(@Param('slug') slug: string): Promise<BusinessResponseDto> {
    return this.businessService.findBySlug(slug);
  }

  @Get('user/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get business by user ID',
    description: 'Retrieve a business by its owner user ID',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: 'clx1234567890abcdef',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Business retrieved successfully',
    type: BusinessResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Business not found for this user',
  })
  async findByUserId(
    @Param('userId') userId: string,
  ): Promise<BusinessResponseDto | null> {
    return this.businessService.findByUserId(userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get business by ID',
    description: 'Retrieve a business by its ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Business ID',
    example: 'clx1234567890abcdef',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Business retrieved successfully',
    type: BusinessResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Business not found',
  })
  async findOne(@Param('id') id: string): Promise<BusinessResponseDto> {
    return this.businessService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Create a new business',
    description: 'Create a new business (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Business created successfully',
    type: BusinessResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin role required',
  })
  async create(
    @Body() createBusinessDto: CreateBusinessDto,
  ): Promise<BusinessResponseDto> {
    return this.businessService.create(createBusinessDto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Update a business',
    description: 'Update an existing business (Admin only)',
  })
  @ApiParam({
    name: 'id',
    description: 'Business ID',
    example: 'clx1234567890abcdef',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Business updated successfully',
    type: BusinessResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Business not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin role required',
  })
  async update(
    @Param('id') id: string,
    @Body() updateBusinessDto: UpdateBusinessDto,
  ): Promise<BusinessResponseDto> {
    return this.businessService.update(id, updateBusinessDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Delete a business',
    description:
      'Soft delete a business by setting isActive to false (Admin only)',
  })
  @ApiParam({
    name: 'id',
    description: 'Business ID',
    example: 'clx1234567890abcdef',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Business deleted successfully',
    type: BusinessResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Business not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin role required',
  })
  async remove(@Param('id') id: string): Promise<BusinessResponseDto> {
    return this.businessService.delete(id);
  }
}
