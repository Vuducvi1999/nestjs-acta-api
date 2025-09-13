import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../common/configs/types/index.type';

@Injectable()
export class HomeService {
  constructor(private configService: ConfigService<AllConfigType>) {}

  appInfo() {
    return { name: this.configService.get('app.name', { infer: true }) };
  }
}
