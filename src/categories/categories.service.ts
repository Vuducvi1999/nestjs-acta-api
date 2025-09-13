import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    try {
      const categories = await this.prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          parent: true,
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
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

      return categories;
    } catch (error) {
      this.logger.error('Error fetching categories:', error);
      throw new InternalServerErrorException('Failed to fetch categories');
    }
  }

  async findRootCategories() {
    try {
      const categories = await this.prisma.category.findMany({
        where: {
          isActive: true,
          parentId: null, // Root categories have no parent
        },
        orderBy: { sortOrder: 'asc' },
        include: {
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: {
              children: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
              },
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

      return categories;
    } catch (error) {
      this.logger.error('Error fetching root categories:', error);
      throw new InternalServerErrorException('Failed to fetch root categories');
    }
  }

  async findOne(id: string) {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id, isActive: true },
        include: {
          parent: true,
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
          products: {
            where: { isActive: true },
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              // product currently relates to category only in schema
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

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      return category;
    } catch (error) {
      this.logger.error(`Error fetching category ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch category');
    }
  }

  async findBySlug(slug: string) {
    try {
      const category = await this.prisma.category.findUnique({
        where: { slug, isActive: true },
        include: {
          parent: true,
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
          products: {
            where: { isActive: true },
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              // product currently relates to category only in schema
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

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      return category;
    } catch (error) {
      this.logger.error(`Error fetching category by slug ${slug}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch category');
    }
  }

  async create(data: any) {
    try {
      const category = await this.prisma.category.create({
        data: {
          ...data,
          slug: data.name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, ''),
        },
      });

      return category;
    } catch (error) {
      this.logger.error('Error creating category:', error);
      throw new InternalServerErrorException('Failed to create category');
    }
  }

  async update(id: string, data: Prisma.CategoryUpdateInput) {
    try {
      const category = await this.prisma.category.update({
        where: { id },
        data,
      });

      return category;
    } catch (error) {
      this.logger.error(`Error updating category ${id}:`, error);
      throw new InternalServerErrorException('Failed to update category');
    }
  }

  async delete(id: string) {
    try {
      // Check if category has children
      const childrenCount = await this.prisma.category.count({
        where: { parentId: id, isActive: true },
      });

      if (childrenCount > 0) {
        throw new InternalServerErrorException(
          'Cannot delete category with subcategories',
        );
      }

      // Check if category has products
      const productsCount = await this.prisma.product.count({
        where: { categoryId: id, isActive: true },
      });

      if (productsCount > 0) {
        throw new InternalServerErrorException(
          'Cannot delete category with products',
        );
      }

      // Soft delete by setting isActive to false
      const category = await this.prisma.category.update({
        where: { id },
        data: { isActive: false },
      });

      return category;
    } catch (error) {
      this.logger.error(`Error deleting category ${id}:`, error);
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete category');
    }
  }
}
