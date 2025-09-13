import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../../auth/jwt-payload';
import { CurrentUser } from '../../../users/users.decorator';
import { UpdateSyncSettingsDto } from '../dto/update-sync-settings.dto';
import { UpdateFieldMappingsDto } from '../dto/update-field-mappings.dto';
import { KiotVietConfigService } from '../services/kiotviet-config.service';
import { KiotVietConfigResponseDto } from '../dto/kiotviet-config-response.dto';

@ApiBearerAuth()
@ApiTags('Integrations: KiotViet Config')
@UseGuards(JwtAuthGuard)
@Controller('integrations/kiotviet/config')
export class KiotVietConfigController {
  constructor(private readonly kiotVietConfigService: KiotVietConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Get KiotViet configuration' })
  @ApiResponse({
    status: 200,
    description: 'KiotViet configuration retrieved successfully',
    type: KiotVietConfigResponseDto,
  })
  async getConfig(
    @CurrentUser() user: JwtPayload,
  ): Promise<KiotVietConfigResponseDto> {
    return this.kiotVietConfigService.getConfig(user);
  }

  @Post('regenerate-api-key')
  @ApiOperation({ summary: 'Regenerate KiotViet API key' })
  @ApiResponse({
    status: 200,
    description: 'API key regenerated successfully',
    type: KiotVietConfigResponseDto,
  })
  async regenerateApiKey(
    @CurrentUser() user: JwtPayload,
  ): Promise<KiotVietConfigResponseDto> {
    return this.kiotVietConfigService.regenerateApiKey(user);
  }

  @Post('request-api-key-otp')
  @ApiOperation({ summary: 'Request OTP for API key retrieval' })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully to admin email',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'API key OTP sent successfully',
        },
      },
    },
  })
  async requestApiKeyOtp(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string; success: boolean }> {
    const result = await this.kiotVietConfigService.requestApiKeyOtp(user);
    return { message: result, success: true };
  }

  @Post('confirm-api-key-retrieval')
  @ApiOperation({ summary: 'Confirm API key retrieval with OTP' })
  @ApiResponse({
    status: 200,
    description: 'API key retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        apiKey: {
          type: 'string',
          example: 'acta_abc123_def456_ghi789',
        },
      },
    },
  })
  async confirmApiKeyRetrieval(
    @CurrentUser() user: JwtPayload,
    @Body() confirmOtpDto: { otp: string },
  ): Promise<{ apiKey: string }> {
    return this.kiotVietConfigService.confirmApiKeyRetrieval(
      user,
      confirmOtpDto.otp,
    );
  }

  @Post('toggle-status')
  @ApiOperation({ summary: 'Toggle KiotViet configuration activation status' })
  @ApiResponse({
    status: 200,
    description: 'Configuration status toggled successfully',
    type: KiotVietConfigResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - configuration not found or invalid request',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - admin access required',
  })
  async toggleConfigStatus(
    @CurrentUser() user: JwtPayload,
  ): Promise<KiotVietConfigResponseDto> {
    return this.kiotVietConfigService.toggleConfigStatus(user);
  }

  @Put('sync-settings')
  @ApiOperation({ summary: 'Update KiotViet synchronization settings' })
  @ApiResponse({
    status: 200,
    description: 'Sync settings updated successfully',
    type: KiotVietConfigResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - invalid sync settings or configuration not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - admin access required',
  })
  async updateSyncSettings(
    @CurrentUser() user: JwtPayload,
    @Body() updateSyncSettingsDto: UpdateSyncSettingsDto,
  ): Promise<KiotVietConfigResponseDto> {
    return this.kiotVietConfigService.updateSyncSettings(
      user,
      updateSyncSettingsDto,
    );
  }

  @Put('field-mappings')
  @ApiOperation({ summary: 'Update KiotViet field mappings' })
  @ApiResponse({
    status: 200,
    description: 'Field mappings updated successfully',
    type: KiotVietConfigResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - invalid field mappings or configuration not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - admin access required',
  })
  async updateFieldMappings(
    @CurrentUser() user: JwtPayload,
    @Body() updateFieldMappingsDto: UpdateFieldMappingsDto,
  ): Promise<KiotVietConfigResponseDto> {
    return this.kiotVietConfigService.updateFieldMappings(
      user,
      updateFieldMappingsDto,
    );
  }
}
