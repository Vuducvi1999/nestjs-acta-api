import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateBusinessDto, UpdateBusinessDto } from './dto';

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    try {
      const businesses = await this.prisma.business.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        include: {
          products: {
            where: { isActive: true },
            take: 5,
            select: {
              id: true,
              name: true,
              price: true,
              thumbnail: true,
            },
          },
          _count: {
            select: {
              products: {
                where: { isActive: true },
              },
            },
          },
        },
      });

      return businesses;
    } catch (error) {
      this.logger.error('Error fetching businesses:', error);
      throw new InternalServerErrorException('Failed to fetch businesses');
    }
  }

  async findOne(id: string) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id, isActive: true },
        include: {
          products: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            include: {
              category: true,
            },
          },
          _count: {
            select: {
              products: {
                where: { isActive: true },
              },
            },
          },
        },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      return business;
    } catch (error) {
      this.logger.error(`Error fetching business ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch business');
    }
  }

  async findBySlug(slug: string) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { slug, isActive: true },
        include: {
          products: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            include: {
              category: true,
            },
          },
          _count: {
            select: {
              products: {
                where: { isActive: true },
              },
            },
          },
        },
      });

      if (!business) {
        throw new NotFoundException('Business not found');
      }

      return business;
    } catch (error) {
      this.logger.error(`Error fetching business by slug ${slug}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch business');
    }
  }

  async findByUserId(userId: string) {
    try {
      const business = await this.prisma.business.findUnique({
        where: { userId, isActive: true },
        include: {
          products: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            include: {
              category: true,
            },
          },
          _count: {
            select: {
              products: {
                where: { isActive: true },
              },
            },
          },
        },
      });

      return business;
    } catch (error) {
      this.logger.error(`Error fetching business by userId ${userId}:`, error);
      throw new InternalServerErrorException('Failed to fetch business');
    }
  }

  async create(data: CreateBusinessDto) {
    try {
      const business = await this.prisma.business.create({
        data: {
          ...data,
          slug: data.name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, ''),
        },
      });

      return business;
    } catch (error) {
      this.logger.error('Error creating business:', error);
      throw new InternalServerErrorException('Failed to create business');
    }
  }

  async update(id: string, data: UpdateBusinessDto) {
    try {
      const business = await this.prisma.business.update({
        where: { id },
        data,
      });

      return business;
    } catch (error) {
      this.logger.error(`Error updating business ${id}:`, error);
      throw new InternalServerErrorException('Failed to update business');
    }
  }

  async delete(id: string) {
    try {
      // Soft delete by setting isActive to false
      const business = await this.prisma.business.update({
        where: { id },
        data: { isActive: false },
      });

      return business;
    } catch (error) {
      this.logger.error(`Error deleting business ${id}:`, error);
      throw new InternalServerErrorException('Failed to delete business');
    }
  }
}
