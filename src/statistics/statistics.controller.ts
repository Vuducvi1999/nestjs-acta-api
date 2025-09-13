import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../users/users.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import { StatisticsService } from './statistics.service';
import { StatisticsQueryDto } from './dto/statistics-query.dto';
import { PaginatedStatisticsResponseDto } from './dto/statistics-response.dto';

@ApiBearerAuth()
@ApiTags('Statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.MODERATOR, Role.USER, Role.COLLABORATOR)
  @ApiOperation({
    summary: 'Get platform statistics',
    description:
      'Retrieve platform statistics including most referrals, most post reactions, and most single post likes with pagination and filtering options',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
    type: PaginatedStatisticsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid query parameters',
  })
  async getStatistics(
    @Query() query: StatisticsQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaginatedStatisticsResponseDto> {
    return this.statisticsService.getStatistics(query, user);
  }
}
