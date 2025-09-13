import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../../users/users.decorator';
import { JwtPayload } from '../../../../auth/jwt-payload';
import { Role } from '../../../../common/enums/role.enum';
import { KiotVietMappingService } from '../../services/kiotviet-mapping/kiotviet-mapping.product.service';
import { KiotVietBaseMapping } from '../../dto/mapping/kiotviet-base-mapping.dto';
import { KiotVietProductMapping } from '../../dto/mapping/kiotviet-product-mapping.dto';

@ApiBearerAuth()
@ApiTags('KiotViet: Product Mapping')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/kiotviet/mapping/products')
export class KiotVietProductMappingController {
  private readonly logger = new Logger(KiotVietProductMappingController.name);

  constructor(
    private readonly kiotVietMappingService: KiotVietMappingService,
  ) {}

  @Roles(Role.ADMIN)
  @Get('sync-analysis')
  @ApiOperation({
    summary: 'Analyze KiotViet products sync status',
    description:
      'Fetch all products from KiotViet, map them to internal format, and compare with database products to generate sync statistics',
  })
  @ApiResponse({
    status: 200,
    description: 'Product sync analysis completed successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          description: 'Mapped KiotViet products',
        },
        groupedStats: {
          type: 'object',
          description: 'Sync statistics grouped by entity type',
          properties: {
            Product: {
              type: 'object',
              properties: {
                components: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      displayName: { type: 'string' },
                      stats: {
                        type: 'object',
                        properties: {
                          adds: {
                            type: 'number',
                            description: 'Products to be added',
                          },
                          updates: {
                            type: 'number',
                            description: 'Products to be updated',
                          },
                          skips: {
                            type: 'number',
                            description: 'Products that are identical',
                          },
                          conflicts: {
                            type: 'number',
                            description: 'Products with conflicts',
                          },
                        },
                      },
                    },
                  },
                },
                totalStats: {
                  type: 'object',
                  properties: {
                    adds: { type: 'number' },
                    updates: { type: 'number' },
                    skips: { type: 'number' },
                    conflicts: { type: 'number' },
                  },
                },
              },
            },
          },
        },
        summary: {
          type: 'object',
          properties: {
            totalKiotVietProducts: { type: 'number' },
            totalDatabaseProducts: { type: 'number' },
            analysisTimestamp: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async analyzeProductSyncStatus(@CurrentUser() user: JwtPayload): Promise<{
    data: KiotVietProductMapping[];
    groupedStats: KiotVietBaseMapping<KiotVietProductMapping>['groupedStats'];
    summary: {
      totalKiotVietProducts: number;
      totalDatabaseProducts: number;
      analysisTimestamp: string;
    };
  }> {
    try {
      this.logger.log(`Starting product sync analysis for user ${user.id}`);

      const startTime = Date.now();
      const result =
        await this.kiotVietMappingService.getMappedKiotVietProducts(user);
      const endTime = Date.now();

      this.logger.log(
        `Product sync analysis completed in ${endTime - startTime}ms for user ${user.id}`,
      );

      // Calculate summary statistics
      const totalKiotVietProducts = result.data.length;
      const totalDatabaseProducts = Object.values(
        result.groupedStats.Product?.totalStats || {},
      ).reduce(
        (sum, value) => sum + (typeof value === 'number' ? value : 0),
        0,
      );

      return {
        data: result.data,
        groupedStats: result.groupedStats,
        summary: {
          totalKiotVietProducts,
          totalDatabaseProducts,
          analysisTimestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Error during product sync analysis for user ${user.id}:`,
        error,
      );
      throw error;
    }
  }

  @Roles(Role.ADMIN)
  @Get('stats-only')
  @ApiOperation({
    summary: 'Get KiotViet products sync statistics only',
    description:
      'Fetch sync statistics without returning the full product data (lighter endpoint for quick overview)',
  })
  @ApiResponse({
    status: 200,
    description: 'Product sync statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        groupedStats: {
          type: 'object',
          description: 'Sync statistics grouped by entity type',
        },
        summary: {
          type: 'object',
          properties: {
            totalKiotVietProducts: { type: 'number' },
            totalDatabaseProducts: { type: 'number' },
            analysisTimestamp: { type: 'string' },
            processingTimeMs: { type: 'number' },
          },
        },
      },
    },
  })
  async getProductSyncStats(@CurrentUser() user: JwtPayload): Promise<{
    groupedStats: KiotVietBaseMapping<KiotVietProductMapping>['groupedStats'];
    summary: {
      totalKiotVietProducts: number;
      totalDatabaseProducts: number;
      analysisTimestamp: string;
      processingTimeMs: number;
    };
  }> {
    try {
      this.logger.log(`Fetching product sync stats for user ${user.id}`);

      const startTime = Date.now();
      const result =
        await this.kiotVietMappingService.getMappedKiotVietProducts(user);
      const endTime = Date.now();
      const processingTimeMs = endTime - startTime;

      this.logger.log(
        `Product sync stats completed in ${processingTimeMs}ms for user ${user.id}`,
      );

      // Calculate summary statistics
      const totalKiotVietProducts = result.data.length;
      const totalDatabaseProducts = Object.values(
        result.groupedStats.Product?.totalStats || {},
      ).reduce(
        (sum, value) => sum + (typeof value === 'number' ? value : 0),
        0,
      );

      return {
        groupedStats: result.groupedStats,
        summary: {
          totalKiotVietProducts,
          totalDatabaseProducts,
          analysisTimestamp: new Date().toISOString(),
          processingTimeMs,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error fetching product sync stats for user ${user.id}:`,
        error,
      );
      throw error;
    }
  }
}
