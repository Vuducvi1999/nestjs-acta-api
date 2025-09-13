import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../common/services/prisma.service';
import {
  buildPickupOptionsForCart,
  CartItemSlim,
} from './warehouse-pickup.helper';

describe('WarehousePickupHelper', () => {
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: {
            warehouse: {
              findMany: jest.fn(),
            },
            productInventory: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('buildPickupOptionsForCart', () => {
    it('should return empty options for empty cart', async () => {
      const result = await buildPickupOptionsForCart(
        prismaService,
        [],
        'warehouse_1',
      );

      expect(result.options).toEqual([]);
      expect(result.chosenWarehouseId).toBe('warehouse_1');
    });

    it('should handle null/undefined cart items', async () => {
      const result = await buildPickupOptionsForCart(
        prismaService,
        null as any,
        'warehouse_1',
      );

      expect(result.options).toEqual([]);
      expect(result.chosenWarehouseId).toBe('warehouse_1');
    });

    it('should call prisma.warehouse.findMany with correct parameters', async () => {
      const mockWarehouses = [
        {
          id: 'warehouse_1',
          name: 'Test Warehouse',
          isActive: true,
          address: null,
        },
      ];

      (prismaService.warehouse.findMany as jest.Mock).mockResolvedValue(
        mockWarehouses,
      );
      (prismaService.productInventory.findMany as jest.Mock).mockResolvedValue(
        [],
      );

      await buildPickupOptionsForCart(prismaService, [
        { productId: 'product_1', quantity: 2, name: 'Test Product' },
      ]);

      expect(prismaService.warehouse.findMany).toHaveBeenCalledWith({
        where: {},
        select: {
          id: true,
          name: true,
          isActive: true,
          address: {
            select: {
              street: true,
              ward: true,
              district: true,
              city: true,
              country: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('CartItemSlim type', () => {
    it('should have correct structure', () => {
      const cartItem: CartItemSlim = {
        productId: 'product_1',
        quantity: 2,
        slug: 'test-product',
        name: 'Test Product',
        image: 'https://example.com/image.jpg',
      };

      expect(cartItem.productId).toBeDefined();
      expect(cartItem.quantity).toBeDefined();
      expect(cartItem.slug).toBeDefined();
      expect(cartItem.name).toBeDefined();
      expect(cartItem.image).toBeDefined();
    });
  });
});
