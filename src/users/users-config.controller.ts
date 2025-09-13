import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserConfigService } from './users-config.service';
import { CurrentUser } from './users.decorator';

@ApiTags('Users Config')
@Controller('users-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UserConfigController {
  constructor(private readonly userConfigService: UserConfigService) {}

  @Post()
  async manualTriggerInitialDefaultUserConfig(@CurrentUser() user: JwtPayload) {
    const config = await this.userConfigService.initialDefaultUserConfig(user);

    return {
      success: true,
      message: 'Initial default user config success',
      config,
    };
  }

  @Patch(':key')
  @UseGuards(JwtAuthGuard)
  async updateKey(
    @Param('key') key: string,
    @Body('value') value: any,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.userConfigService.updateUserConfigKey(user, key, value);
    return { success: true, message: 'Update user config success' };
  }
}
