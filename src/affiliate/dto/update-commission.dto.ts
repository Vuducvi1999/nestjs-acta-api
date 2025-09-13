import { PartialType } from '@nestjs/mapped-types';
import { CreateAffiliateCommissionDto } from './create-commission.dto';

export class UpdateAffiliateCommissionDto extends PartialType(
  CreateAffiliateCommissionDto,
) {}
