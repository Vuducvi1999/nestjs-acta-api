import { Transform } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

export class NewsCommentQueryDto {
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return parseInt(value, 10);
    }
    return value;
  })
  page?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return parseInt(value, 10);
    }
    return value;
  })
  limit?: number;

}