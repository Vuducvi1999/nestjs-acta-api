import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AffiliateCommissionService } from './affiliate-commission.service';
import { CreateAffiliateCommissionDto } from './dto/create-commission.dto';
import { UpdateAffiliateCommissionDto } from './dto/update-commission.dto';
import { CalculateCommissionDto } from './dto/calculate-commission.dto';
import { CommissionQueryDto } from './dto/commission-query.dto';
import { AffiliateCommissionResponseDto } from './dto/commission-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../users/users.decorator';
import { JwtPayload } from '../auth/jwt-payload';

@ApiTags('Affiliate Commissions')
@Controller('affiliate-commissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AffiliateCommissionController {
  constructor(
    private readonly affiliateCommissionService: AffiliateCommissionService,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new affiliate commission' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Commission created successfully',
    type: AffiliateCommissionResponseDto,
  })
  create(
    @Body() createDto: CreateAffiliateCommissionDto,
  ): Promise<AffiliateCommissionResponseDto> {
    return this.affiliateCommissionService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all affiliate commissions with filters' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Commissions retrieved successfully',
    type: [AffiliateCommissionResponseDto],
  })
  findAll(@Query() query: CommissionQueryDto) {
    return this.affiliateCommissionService.findAll(query);
  }

  @Get('my-commissions')
  @ApiOperation({ summary: 'Get current user commissions' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User commissions retrieved successfully',
  })
  getMyCommissions(
    @Query() query: CommissionQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.affiliateCommissionService.getUserCommissions(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific affiliate commission' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Commission retrieved successfully',
    type: AffiliateCommissionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Commission not found',
  })
  findOne(@Param('id') id: string): Promise<AffiliateCommissionResponseDto> {
    return this.affiliateCommissionService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update an affiliate commission' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Commission updated successfully',
    type: AffiliateCommissionResponseDto,
  })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAffiliateCommissionDto,
  ): Promise<AffiliateCommissionResponseDto> {
    return this.affiliateCommissionService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete an affiliate commission' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Commission deleted successfully',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.affiliateCommissionService.remove(id);
  }

  @Post('calculate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Calculate commissions for a completed order' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Commissions calculated successfully',
  })
  calculateCommissions(@Body() calculateDto: CalculateCommissionDto) {
    return this.affiliateCommissionService.calculateCommissions(calculateDto);
  }

  @Post(':id/mark-paid')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Mark a commission as paid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Commission marked as paid successfully',
    type: AffiliateCommissionResponseDto,
  })
  markAsPaid(
    @Param('id') id: string,
    @Body() body: { paidBy: string },
  ): Promise<AffiliateCommissionResponseDto> {
    return this.affiliateCommissionService.markAsPaid(id, body.paidBy);
  }

  @Get('statistics/overview')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get commission statistics overview' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
  })
  async getStatistics() {
    const [totalCommissions, totalAmount, pendingAmount, paidAmount] =
      await Promise.all([
        this.affiliateCommissionService.findAll({ limit: 1 }),
        this.affiliateCommissionService.findAll({ limit: 1 }),
        this.affiliateCommissionService.findAll({
          limit: 1,
          status: 'calculated',
        }),
        this.affiliateCommissionService.findAll({ limit: 1, status: 'paid' }),
      ]);

    return {
      totalCommissions: totalCommissions.total,
      totalAmount: totalAmount.data.reduce(
        (sum, comm) => sum + Number(comm.commissionAmount),
        0,
      ),
      pendingAmount: pendingAmount.data.reduce(
        (sum, comm) => sum + Number(comm.commissionAmount),
        0,
      ),
      paidAmount: paidAmount.data.reduce(
        (sum, comm) => sum + Number(comm.commissionAmount),
        0,
      ),
    };
  }
}
