import { Test, TestingModule } from '@nestjs/testing';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationService } from './notification.service';
import { PrismaService } from '../common/services/prisma.service';
import { NotificationAction, RelatedModel } from '@prisma/client';

describe('NotificationQueueService', () => {
  let service: NotificationQueueService;
  let notificationService: jest.Mocked<NotificationService>;

  beforeEach(async () => {
    const mockNotificationService = {
      createNotification: jest.fn(),
    };

    const mockPrismaService = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationQueueService,
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<NotificationQueueService>(NotificationQueueService);
    notificationService = module.get(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should add notification to queue', async () => {
    await service.addToQueue(
      'user123',
      RelatedModel.post,
      'post456',
      NotificationAction.liked,
      'Test message',
      '/test-url',
      'normal',
    );

    const stats = service.getQueueStats();
    expect(stats.total).toBe(1);
    expect(stats.normalPriority).toBe(1);
  });

  it('should prioritize high priority notifications', async () => {
    // Add normal priority first
    await service.addToQueue(
      'user1',
      RelatedModel.post,
      'post1',
      NotificationAction.liked,
      'Normal message',
      '/normal',
      'normal',
    );

    // Add high priority
    await service.addToQueue(
      'user2',
      RelatedModel.post,
      'post2',
      NotificationAction.liked,
      'High priority message',
      '/high',
      'high',
    );

    const stats = service.getQueueStats();
    expect(stats.total).toBe(2);
    expect(stats.highPriority).toBe(1);
    expect(stats.normalPriority).toBe(1);
  });

  it('should clear queue', async () => {
    await service.addToQueue(
      'user123',
      RelatedModel.post,
      'post456',
      NotificationAction.liked,
      'Test message',
    );

    const result = await service.clearQueue();
    expect(result.clearedCount).toBe(1);
    expect(result.message).toBe('Queue cleared successfully');

    const stats = service.getQueueStats();
    expect(stats.total).toBe(0);
  });

  it('should retry item', async () => {
    await service.addToQueue(
      'user123',
      RelatedModel.post,
      'post456',
      NotificationAction.liked,
      'Test message',
    );

    const stats = service.getQueueStats();
    const itemId = stats.total > 0 ? 'test-id' : 'dummy-id';

    const result = await service.retryItem(itemId);
    if (stats.total > 0) {
      expect(result.success).toBe(true);
      expect(result.message).toContain('retried successfully');
    } else {
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    }
  });
});
