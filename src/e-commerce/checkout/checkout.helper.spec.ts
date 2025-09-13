import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutHelper } from './checkout.helper';
import { PrismaService } from '../../common/services/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('CheckoutHelper', () => {
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: {
            warehouse: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('selectOptimalWarehouse', () => {
    it('should select warehouse with best product coverage and stock', async () => {
      const mockWarehouses = [
        {
          id: 'warehouse-1',
          name: 'Warehouse A',
          isActive: true,
          productInventories: [
            { productId: 'product-1', onHand: 10, reserved: 2 },
            { productId: 'product-2', onHand: 5, reserved: 1 },
          ],
        },
        {
          id: 'warehouse-2',
          name: 'Warehouse B',
          isActive: true,
          productInventories: [
            { productId: 'product-1', onHand: 15, reserved: 0 },
            { productId: 'product-2', onHand: 8, reserved: 0 },
            { productId: 'product-3', onHand: 12, reserved: 1 },
          ],
        },
      ];

      (prismaService.warehouse.findMany as jest.Mock).mockResolvedValue(
        mockWarehouses,
      );

      const productIds = ['product-1', 'product-2', 'product-3'];
      const result = await CheckoutHelper.selectOptimalWarehouse(
        prismaService,
        productIds,
      );

      // Warehouse B should be selected as it has better coverage (3/3 products) and more stock
      expect(result.id).toBe('warehouse-2');
      expect(result.name).toBe('Warehouse B');
    });

    it('should fallback to default warehouse when no products provided', async () => {
      const mockDefaultWarehouse = {
        id: 'default-warehouse',
        name: 'Default Warehouse',
        isActive: true,
      };

      (prismaService.warehouse.findFirst as jest.Mock).mockResolvedValue(
        mockDefaultWarehouse,
      );

      const result = await CheckoutHelper.selectOptimalWarehouse(
        prismaService,
        [],
      );

      expect(result.id).toBe('default-warehouse');
      expect(result.name).toBe('Default Warehouse');
    });

    it('should throw error when no active warehouses found', async () => {
      (prismaService.warehouse.findMany as jest.Mock).mockResolvedValue([]);

      const productIds = ['product-1', 'product-2'];

      await expect(
        CheckoutHelper.selectOptimalWarehouse(prismaService, productIds),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prioritize warehouses with higher product coverage', async () => {
      const mockWarehouses = [
        {
          id: 'warehouse-1',
          name: 'Warehouse A',
          isActive: true,
          productInventories: [
            { productId: 'product-1', onHand: 5, reserved: 0 },
          ],
        },
        {
          id: 'warehouse-2',
          name: 'Warehouse B',
          isActive: true,
          productInventories: [
            { productId: 'product-1', onHand: 3, reserved: 0 },
            { productId: 'product-2', onHand: 4, reserved: 0 },
          ],
        },
      ];

      (prismaService.warehouse.findMany as jest.Mock).mockResolvedValue(
        mockWarehouses,
      );

      const productIds = ['product-1', 'product-2'];
      const result = await CheckoutHelper.selectOptimalWarehouse(
        prismaService,
        productIds,
      );

      // Warehouse B should be selected as it has better coverage (2/2 products vs 1/2)
      expect(result.id).toBe('warehouse-2');
    });
  });
});
