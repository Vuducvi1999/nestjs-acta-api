import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../common/services/prisma.service';
import { HomeService } from './home.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Home')
@Public()
@Controller()
export class HomeController {
  constructor(
    private service: HomeService,
    private healthService: HealthCheckService,
    private db: PrismaHealthIndicator,
  ) {}

  @Get()
  
  appInfo() {
    return this.service.appInfo();
  }

  @Get('liveness')
  liveness() {
    return this.healthService.check([]);
  }

  @Get('readiness')
  readiness() {
    return this.healthService.check([
      () => this.db.pingCheck('prisma db', new PrismaService()),
    ]);
  }
}
