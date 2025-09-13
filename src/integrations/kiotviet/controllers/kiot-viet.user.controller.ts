import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser } from '../../../users/users.decorator';
import { JwtPayload } from '../../../auth/jwt-payload';
import { KiotVietApiKey } from '../../../common/decorators/integrations.decorator';
import { ApiKeyValidationService } from '../../api-key-validation.service';
import { KiotVietUserService } from '../services/kiot-viet.user.service';

@ApiBearerAuth()
@ApiTags('KiotViet: Users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/kiotviet/users')
export class KiotVietUserController {
  constructor(
    private readonly userService: KiotVietUserService,
    private readonly apiKeyValidationService: ApiKeyValidationService,
  ) {}

  @ApiSecurity('KiotVietApiKey')
  @Roles(Role.ADMIN)
  @Get()
  async getUsers(@CurrentUser() user: JwtPayload) {
    return this.userService.getUsers(user);
  }

  @ApiSecurity('KiotVietApiKey')
  @Get(':id')
  async getUserById(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') userId: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.userService.getUserById(user, userId);
  }

  @ApiSecurity('KiotVietApiKey')
  @Post()
  async createUser(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Body() userData: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.userService.createUser(user, userData);
  }

  @ApiSecurity('KiotVietApiKey')
  @Put(':id')
  async updateUser(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') userId: string,
    @Body() userData: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.userService.updateUser(user, userId, userData);
  }

  @ApiSecurity('KiotVietApiKey')
  @Delete(':id')
  async deleteUser(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') userId: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    await this.userService.deleteUser(user, userId);
    return { message: 'User deleted successfully' };
  }
}
