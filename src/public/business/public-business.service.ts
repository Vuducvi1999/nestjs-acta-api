import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PublicBrandDetailDto } from '../products/dto/public-product-response.dto';

@Injectable()
export class PublicBusinessService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getBrandDetail(id: string): Promise<PublicBrandDetailDto> {
    const cacheKey = `public:business:${id}`;
    const cached = await this.cache.get<PublicBrandDetailDto>(cacheKey);
    if (cached) return cached;

    const business = await this.prisma.business.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logo: true,
        createdAt: true,
        rating: true,
        user: {
          select: {
            avatar: { select: { fileUrl: true } },
          },
        },
        _count: { select: { products: true } },
      },
    });

    if (!business) {
      // mimic not found via empty dto or you can throw Nest NotFoundException
      return {
        id,
        name: '',
        slug: '',
        productCount: 0,
      } as PublicBrandDetailDto;
    }

    const dto = PublicBrandDetailDto.fromBusiness({
      ...business,
      avatarUrl: business?.user?.avatar?.fileUrl,
    });
    await this.cache.set(cacheKey, dto, 300);
    return dto;
  }
}
