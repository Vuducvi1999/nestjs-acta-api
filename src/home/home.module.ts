import { Module } from '@nestjs/common';
import { HomeService } from './home.service';
import { HomeController } from './home.controller';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';

@Module({
  imports: [TerminusModule, ConfigModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
