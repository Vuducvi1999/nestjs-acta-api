import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import * as crypto from 'crypto';
import { JwtPayload } from '../../../auth/jwt-payload';
import { Role } from '@prisma/client';
import { MailService } from '../../../mail/mail.service';
import { ActivityLogService } from '../../../activity-logs/activity-log.service';
import { ActivityType } from '@prisma/client';
import { IntegrationHelper } from '../../../integrations/integration.helper';
import { UpdateSyncSettingsDto } from '../dto/update-sync-settings.dto';
import { UpdateFieldMappingsDto } from '../dto/update-field-mappings.dto';
import { KiotVietConfigResponseDto } from '../dto/kiotviet-config-response.dto';

@Injectable()
export class KiotVietConfigService {
  private readonly logger = new Logger(KiotVietConfigService.name);

  /**
   * Handle errors consistently
   */
  private handleError(error: any, operation: string, logger?: Logger): never {
    const loggerInstance = logger || this.logger;
    loggerInstance.error(
      `Error in KiotViet Config - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly helper: IntegrationHelper,
    private readonly mailService: MailService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  /**
   * Generate a secure API key for integrations
   * @returns A cryptographically secure API key
   */
  private generateApiKey(): string {
    // Generate random bytes for better security
    const randomBytes = crypto.randomBytes(16); // 16 bytes = 32 hex characters
    const timestamp = Date.now().toString(36);
    const suffix = Math.random().toString(36).substring(2, 8); // Additional entropy

    // Format: acta_[timestamp]_[random]_[suffix]
    return `acta_${timestamp}_${randomBytes.toString('hex')}_${suffix}`;
  }

  /**
   * Initial a new kiotviet configuration for system
   */
  async initialConfig(user: JwtPayload): Promise<KiotVietConfigResponseDto> {
    try {
      // Check if user is admin
      const userRole = await this.helper.validateAndGetUserRole(user);
      if (userRole !== Role.admin) {
        throw new UnauthorizedException('Access denied');
      }

      // Check if KiotViet config already exists
      const existingKiotVietConfig =
        await this.prisma.kiotVietConfig.findFirst();

      if (existingKiotVietConfig) {
        return KiotVietConfigResponseDto.fromPrisma(existingKiotVietConfig);
      }

      // Create default field mappings
      const defaultFieldMappings = {
        product: {
          // Core product fields
          id: 'id',
          code: 'code',
          masterCode: 'masterCode',
          masterProductId: 'masterProductId',
          masterUnitId: 'masterUnitId',
          masterUnitName: 'masterUnitName',
          categoryId: 'categoryId',
          categoryName: 'categoryName',
          tradeMarkId: 'tradeMarkId',
          tradeMarkName: 'tradeMarkName',
          fullName: 'fullName',
          type: 'type',
          description: 'description',
          hasVariants: 'hasVariants',
          allowsSale: 'allowsSale',
          isActive: 'isActive',
          isLotSerialControl: 'isLotSerialControl',
          isBatchExpireControl: 'isBatchExpireControl',
          taxType: 'taxType',
          taxRate: 'taxRate',
          taxname: 'taxname',
          weight: 'weight',
          unit: 'unit',
          conversionValue: 'conversionValue',
          units: 'units',
          images: 'images',
          inventories: 'inventories',
        },
        customer: {
          name: 'customerName',
          code: 'customerCode',
          phone: 'contactNumber',
          email: 'email',
          address: 'address',
        },
        order: {
          code: 'orderCode',
          customer: 'customerCode',
          items: 'orderDetails',
          total: 'total',
          status: 'status',
        },
        pricebook: {
          name: 'name',
          description: 'description',
          price: 'price',
          type: 'type',
          isActive: 'isActive',
          isGlobal: 'isGlobal',
          startDate: 'startDate',
          endDate: 'endDate',
          forAllCusGroup: 'forAllCusGroup',
          forAllWarehouse: 'forAllWarehouse',
          forAllUser: 'forAllUser',
          source: 'source',
          products: 'products',
          warehouses: 'warehouses',
          customerGroups: 'customerGroups',
          users: 'users',
        },
      };

      // Create default sync settings
      const defaultSyncSettings = {
        autoSync: false,
        syncInterval: 3600, // 1 hour in seconds
        syncProducts: false,
        syncCustomers: false,
        syncOrders: false,
        syncCategories: false,
        lastSync: null,
        retryAttempts: 3,
        retryDelay: 5000, // 5 seconds
      };

      // Create system config with KiotViet config
      const systemConfig = await this.prisma.systemConfig.create({
        data: {
          kiotvietConfig: {
            create: {
              apiKey: this.generateApiKey(), // Generate secure API key
              isActive: false, // Set to false as requested
              fieldMappings: defaultFieldMappings,
              syncSettings: defaultSyncSettings,
            },
          },
        },
        include: {
          kiotvietConfig: {
            omit: {
              apiKey: true,
            },
          },
        },
      });

      return KiotVietConfigResponseDto.fromPrisma(systemConfig.kiotvietConfig);
    } catch (error) {
      this.handleError(error, 'initialize KiotViet configuration');
    }
  }

  async getConfig(user: JwtPayload): Promise<KiotVietConfigResponseDto> {
    try {
      // Check if user is admin
      const userRole = await this.helper.validateAndGetUserRole(user);
      if (userRole !== Role.admin) {
        throw new UnauthorizedException('Access denied');
      }

      const systemConfig = await this.prisma.systemConfig.findFirst({
        where: {
          kiotvietConfig: {
            isNot: null,
          },
        },
        include: {
          kiotvietConfig: {
            omit: {
              apiKey: true,
            },
          },
        },
      });

      if (!systemConfig || !systemConfig.kiotvietConfig) {
        return await this.initialConfig(user);
      }

      return KiotVietConfigResponseDto.fromPrisma(systemConfig.kiotvietConfig);
    } catch (error) {
      this.handleError(error, 'retrieve KiotViet configuration');
    }
  }

  /**
   * Regenerate API key for KiotViet integration
   * @returns Updated configuration with new API key
   */
  async regenerateApiKey(user: JwtPayload): Promise<KiotVietConfigResponseDto> {
    try {
      // Check if user is admin
      const userRole = await this.helper.validateAndGetUserRole(user);
      if (userRole !== Role.admin) {
        throw new UnauthorizedException('Access denied');
      }

      const systemConfig = await this.prisma.systemConfig.findFirst({
        where: {
          kiotvietConfig: {
            isNot: null,
          },
        },
        include: {
          kiotvietConfig: {
            omit: {
              apiKey: true,
            },
          },
        },
      });

      if (!systemConfig || !systemConfig.kiotvietConfig) {
        throw new BadRequestException('KiotViet configuration not found');
      }

      const newApiKey = this.generateApiKey();

      const updatedConfig = await this.prisma.kiotVietConfig.update({
        where: {
          id: systemConfig.kiotvietConfig.id,
        },
        data: {
          apiKey: newApiKey,
        },
      });

      return KiotVietConfigResponseDto.fromPrisma(updatedConfig);
    } catch (error) {
      this.handleError(error, 'regenerate KiotViet API key');
    }
  }

  /**
   * Request OTP for API key retrieval
   * @param user JWT payload of the requesting user
   * @returns Success message
   */
  async requestApiKeyOtp(user: JwtPayload): Promise<string> {
    try {
      // Check if user is admin
      const userRole = await this.helper.validateAndGetUserRole(user);
      if (userRole !== Role.admin) {
        throw new UnauthorizedException('Access denied');
      }

      // Get user details
      const userDetails = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          referenceId: true,
        },
      });

      if (!userDetails) {
        throw new NotFoundException('User not found');
      }

      // Check if KiotViet config exists, initialize if not
      let systemConfig = await this.prisma.systemConfig.findFirst({
        where: {
          kiotvietConfig: {
            isNot: null,
          },
        },
      });

      if (!systemConfig) {
        // Initialize KiotViet configuration if it doesn't exist
        await this.initialConfig(user);
        systemConfig = await this.prisma.systemConfig.findFirst({
          where: {
            kiotvietConfig: {
              isNot: null,
            },
          },
        });
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const validUntil = new Date(Date.now() + 2 * 60 * 1000); // valid 2 minutes

      // Debug: Log the OTP being created
      this.logger.debug(
        `Creating OTP for user ${user.id}: ${otp}, valid until: ${validUntil}`,
      );

      // Always delete old OTP regardless of validity
      await this.prisma.$transaction([
        this.prisma.apiKeyOtp.deleteMany({ where: { userId: user.id } }),
        this.prisma.apiKeyOtp.create({
          data: {
            userId: user.id,
            token: otp,
            validUntil,
          },
        }),
      ]);

      // Debug: Verify the OTP was stored correctly
      const storedOtp = await this.prisma.apiKeyOtp.findUnique({
        where: { userId: user.id },
      });
      this.logger.debug(`Stored OTP record: ${JSON.stringify(storedOtp)}`);

      // Log activity
      await this.activityLogService.createActivityLog(
        user.id,
        'USER',
        ActivityType.USER_PASSWORD_CHANGE_OTP_REQUESTED, // Reusing existing activity type
        user,
        `User ${userDetails.fullName} requested API key OTP`,
        {
          requestedUser: {
            id: user.id,
            referenceId: userDetails.referenceId,
            email: userDetails.email,
          },
        },
      );

      // Send OTP email
      await this.mailService.sendApiKeyOtpEmail(
        userDetails.fullName,
        userDetails.email,
        otp,
      );

      return 'API key OTP sent successfully';
    } catch (error) {
      this.handleError(error, 'request API key OTP');
    }
  }

  /**
   * Confirm API key retrieval with OTP
   * @param user JWT payload of the requesting user
   * @param otp 6-digit OTP
   * @returns API key
   */
  async confirmApiKeyRetrieval(
    user: JwtPayload,
    otp: string,
  ): Promise<{ apiKey: string }> {
    try {
      // Check if user is admin
      const userRole = await this.helper.validateAndGetUserRole(user);
      if (userRole !== Role.admin) {
        throw new UnauthorizedException('Access denied');
      }

      // Get user details
      const userDetails = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          referenceId: true,
        },
      });

      if (!userDetails) {
        throw new NotFoundException('User not found');
      }

      // Debug: Log the OTP being verified
      this.logger.debug(`Verifying OTP for user ${user.id}: ${otp}`);

      // Verify OTP - FIXED: Use correct query structure
      const otpRecord = await this.prisma.apiKeyOtp.findUnique({
        where: { userId: user.id },
      });

      // Debug: Log the found OTP record
      this.logger.debug(`Found OTP record: ${JSON.stringify(otpRecord)}`);

      if (!otpRecord) {
        this.logger.debug('No OTP record found for user');
        throw new BadRequestException('Invalid or expired OTP');
      }

      if (otpRecord.token !== otp) {
        this.logger.debug(
          `OTP mismatch. Expected: ${otpRecord.token}, Received: ${otp}`,
        );
        throw new BadRequestException('Invalid or expired OTP');
      }

      if (otpRecord.validUntil < new Date()) {
        this.logger.debug(
          `OTP expired. Valid until: ${otpRecord.validUntil}, Current time: ${new Date()}`,
        );
        throw new BadRequestException('Invalid or expired OTP');
      }

      // Debug: Log successful validation
      this.logger.debug('OTP validation successful');

      // Get KiotViet config
      const systemConfig = await this.prisma.systemConfig.findFirst({
        where: {
          kiotvietConfig: {
            isNot: null,
          },
        },
        include: {
          kiotvietConfig: true,
        },
      });

      if (!systemConfig || !systemConfig.kiotvietConfig) {
        throw new BadRequestException('KiotViet configuration not found');
      }

      // Delete OTP after successful verification
      await this.prisma.apiKeyOtp.delete({ where: { userId: user.id } });

      // Log activity
      await this.activityLogService.createActivityLog(
        user.id,
        'USER',
        ActivityType.USER_PASSWORD_CHANGED, // Reusing existing activity type
        user,
        `User ${userDetails.fullName} retrieved API key`,
        {
          changedUser: {
            id: user.id,
            referenceId: userDetails.referenceId,
            email: userDetails.email,
            updatedAt: new Date(),
          },
        },
      );

      return { apiKey: systemConfig.kiotvietConfig.apiKey };
    } catch (error) {
      this.handleError(error, 'confirm API key retrieval');
    }
  }

  /**
   * Toggle KiotViet configuration activation status
   * @param user JWT payload of the requesting user
   * @returns Updated configuration with new activation status
   */
  async toggleConfigStatus(
    user: JwtPayload,
  ): Promise<KiotVietConfigResponseDto> {
    try {
      // Check if user is admin
      const userRole = await this.helper.validateAndGetUserRole(user);
      if (userRole !== Role.admin) {
        throw new UnauthorizedException('Access denied');
      }

      // Get user details for activity logging
      const userDetails = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          referenceId: true,
        },
      });

      if (!userDetails) {
        throw new NotFoundException('User not found');
      }

      // Get current KiotViet configuration
      const systemConfig = await this.prisma.systemConfig.findFirst({
        where: {
          kiotvietConfig: {
            isNot: null,
          },
        },
        include: {
          kiotvietConfig: {
            omit: {
              apiKey: true,
            },
          },
        },
      });

      if (!systemConfig || !systemConfig.kiotvietConfig) {
        throw new BadRequestException('KiotViet configuration not found');
      }

      const currentStatus = systemConfig.kiotvietConfig.isActive;
      const newStatus = !currentStatus;

      // Update configuration status
      const updatedConfig = await this.prisma.kiotVietConfig.update({
        where: {
          id: systemConfig.kiotvietConfig.id,
        },
        data: {
          isActive: newStatus,
        },
        omit: {
          apiKey: true,
        },
      });

      // Log activity
      const action = newStatus ? 'activated' : 'deactivated';
      await this.activityLogService.createActivityLog(
        user.id,
        'USER',
        ActivityType.USER_CONFIG_UPDATED,
        user,
        `User ${userDetails.fullName} ${action} KiotViet integration`,
        {
          configuration: {
            type: 'KiotViet Integration',
            action: action,
            previousStatus: currentStatus,
            newStatus: newStatus,
            updatedAt: new Date(),
          },
          user: {
            id: user.id,
            referenceId: userDetails.referenceId,
            email: userDetails.email,
          },
        },
      );

      this.logger.log(
        `KiotViet configuration ${action} by user ${userDetails.fullName} (${userDetails.email})`,
      );

      return KiotVietConfigResponseDto.fromPrisma(updatedConfig);
    } catch (error) {
      this.handleError(error, 'toggle KiotViet configuration status');
    }
  }

  /**
   * Update KiotViet synchronization settings
   * @param user JWT payload of the requesting user
   * @param updateSyncSettingsDto Sync settings to update
   * @returns Updated configuration with new sync settings
   */
  async updateSyncSettings(
    user: JwtPayload,
    updateSyncSettingsDto: UpdateSyncSettingsDto,
  ): Promise<KiotVietConfigResponseDto> {
    try {
      // Check if user is admin
      const userRole = await this.helper.validateAndGetUserRole(user);
      if (userRole !== Role.admin) {
        throw new UnauthorizedException('Access denied');
      }

      // Get user details for activity logging
      const userDetails = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          referenceId: true,
        },
      });

      if (!userDetails) {
        throw new NotFoundException('User not found');
      }

      // Get current KiotViet configuration
      const systemConfig = await this.prisma.systemConfig.findFirst({
        where: {
          kiotvietConfig: {
            isNot: null,
          },
        },
        include: {
          kiotvietConfig: true,
        },
      });

      if (!systemConfig || !systemConfig.kiotvietConfig) {
        throw new BadRequestException('KiotViet configuration not found');
      }

      const currentSyncSettings = systemConfig.kiotvietConfig
        .syncSettings as any;

      // Merge current settings with updates
      const updatedSyncSettings = {
        ...currentSyncSettings,
        ...updateSyncSettingsDto,
      };

      // Validate business logic
      if (updateSyncSettingsDto.autoSync === false) {
        // If auto sync is disabled, disable all sub-sync options
        updatedSyncSettings.syncProducts = false;
        updatedSyncSettings.syncCustomers = false;
        updatedSyncSettings.syncOrders = false;
        updatedSyncSettings.syncCategories = false;
      }

      // Update configuration
      const updatedConfig = await this.prisma.kiotVietConfig.update({
        where: {
          id: systemConfig.kiotvietConfig.id,
        },
        data: {
          syncSettings: updatedSyncSettings,
        },
        omit: {
          apiKey: true,
        },
      });

      // Log activity
      await this.activityLogService.createActivityLog(
        user.id,
        'USER',
        ActivityType.USER_CONFIG_UPDATED,
        user,
        `User ${userDetails.fullName} updated KiotViet sync settings`,
        {
          configuration: {
            type: 'KiotViet Sync Settings',
            action: 'updated',
            changes: updateSyncSettingsDto,
            updatedAt: new Date(),
          },
          user: {
            id: user.id,
            referenceId: userDetails.referenceId,
            email: userDetails.email,
          },
        },
      );

      this.logger.log(
        `KiotViet sync settings updated by user ${userDetails.fullName} (${userDetails.email})`,
      );

      return KiotVietConfigResponseDto.fromPrisma(updatedConfig);
    } catch (error) {
      this.handleError(error, 'update KiotViet sync settings');
    }
  }

  /**
   * Update KiotViet field mappings
   * @param user JWT payload of the requesting user
   * @param updateFieldMappingsDto Field mappings to update
   * @returns Updated configuration with new field mappings
   */
  async updateFieldMappings(
    user: JwtPayload,
    updateFieldMappingsDto: UpdateFieldMappingsDto,
  ): Promise<KiotVietConfigResponseDto> {
    try {
      // Check if user is admin
      const userRole = await this.helper.validateAndGetUserRole(user);
      if (userRole !== Role.admin) {
        throw new UnauthorizedException('Access denied');
      }

      // Get user details for activity logging
      const userDetails = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          referenceId: true,
        },
      });

      if (!userDetails) {
        throw new NotFoundException('User not found');
      }

      // Get current KiotViet configuration
      const systemConfig = await this.prisma.systemConfig.findFirst({
        where: {
          kiotvietConfig: {
            isNot: null,
          },
        },
        include: {
          kiotvietConfig: true,
        },
      });

      if (!systemConfig || !systemConfig.kiotvietConfig) {
        throw new BadRequestException('KiotViet configuration not found');
      }

      const currentFieldMappings = systemConfig.kiotvietConfig
        .fieldMappings as any;

      // Merge current field mappings with updates
      const updatedFieldMappings = {
        ...currentFieldMappings,
      };

      // Update product field mappings if provided
      if (updateFieldMappingsDto.product) {
        updatedFieldMappings.product = {
          ...currentFieldMappings.product,
          ...updateFieldMappingsDto.product,
        };
      }

      // Update customer field mappings if provided
      if (updateFieldMappingsDto.customer) {
        updatedFieldMappings.customer = {
          ...currentFieldMappings.customer,
          ...updateFieldMappingsDto.customer,
        };
      }

      // Update order field mappings if provided
      if (updateFieldMappingsDto.order) {
        updatedFieldMappings.order = {
          ...currentFieldMappings.order,
          ...updateFieldMappingsDto.order,
        };
      }

      // Update configuration
      const updatedConfig = await this.prisma.kiotVietConfig.update({
        where: {
          id: systemConfig.kiotvietConfig.id,
        },
        data: {
          fieldMappings: updatedFieldMappings,
        },
        omit: {
          apiKey: true,
        },
      });

      // Log activity
      await this.activityLogService.createActivityLog(
        user.id,
        'USER',
        ActivityType.USER_CONFIG_UPDATED,
        user,
        `User ${userDetails.fullName} updated KiotViet field mappings`,
        {
          configuration: {
            type: 'KiotViet Field Mappings',
            action: 'updated',
            changes: updateFieldMappingsDto,
            updatedAt: new Date(),
          },
          user: {
            id: user.id,
            referenceId: userDetails.referenceId,
            email: userDetails.email,
          },
        },
      );

      this.logger.log(
        `KiotViet field mappings updated by user ${userDetails.fullName} (${userDetails.email})`,
      );

      return KiotVietConfigResponseDto.fromPrisma(updatedConfig);
    } catch (error) {
      this.handleError(error, 'update KiotViet field mappings');
    }
  }
}
