#!/usr/bin/env ts-node

/**
 * Birthday Notification Test Script
 * 
 * This script helps test the birthday notification system by:
 * 1. Checking users with upcoming birthdays
 * 2. Manually triggering notifications
 * 3. Verifying notification creation
 * 
 * Usage:
 * npx ts-node scripts/test-birthday-notifications.ts [action]
 * 
 * Actions:
 * - check: Check users with upcoming birthdays
 * - trigger: Manually trigger birthday notifications
 * - verify: Verify recent notifications
 * - setup: Setup test data
 */

import { PrismaClient } from '@prisma/client';
import { Logger } from '@nestjs/common';

const prisma = new PrismaClient();
const logger = new Logger('BirthdayNotificationTest');

interface TestUser {
  id: string;
  fullName: string;
  email: string;
  dob: Date | null;
  referrerId: string | null;
  daysUntilBirthday?: number;
}

class BirthdayNotificationTester {
  
  /**
   * Check users with upcoming birthdays
   */
  async checkUpcomingBirthdays(): Promise<void> {
    logger.log('🔍 Checking users with upcoming birthdays...\n');

    try {
      // Get users with birthdays in the next 3 days
      const users = await prisma.user.findMany({
        where: {
          dob: { not: null },
          isActive: true,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          dob: true,
          referrerId: true,
          referrer: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });

      const usersWithUpcomingBirthdays = users.filter(user => {
        if (!user.dob) return false;
        const daysUntil = this.calculateDaysUntilBirthday(user.dob);
        return daysUntil === 3; // 3 days threshold
      });

      logger.log(`📊 Results:`);
      logger.log(`  Total users with DOB: ${users.filter(u => u.dob).length}`);
      logger.log(`  Users with upcoming birthdays (3 days): ${usersWithUpcomingBirthdays.length}\n`);

      if (usersWithUpcomingBirthdays.length === 0) {
        logger.log('⚠️  No users found with birthdays in 3 days');
        logger.log('💡 Use the "setup" action to create test data\n');
        return;
      }

      logger.log('🎂 Users with upcoming birthdays:');
      usersWithUpcomingBirthdays.forEach((user, index) => {
        const daysUntil = this.calculateDaysUntilBirthday(user.dob!);
        logger.log(`\n  ${index + 1}. ${user.fullName} (${user.email})`);
        logger.log(`     Birthday: ${user.dob?.toISOString().split('T')[0]}`);
        logger.log(`     Days until: ${daysUntil}`);
        logger.log(`     Has referrer: ${user.referrer ? `${user.referrer.fullName}` : 'No'}`);
      });

    } catch (error) {
      logger.error('❌ Error checking upcoming birthdays:', error);
    }
  }

  /**
   * Setup test data for birthday notifications
   */
  async setupTestData(): Promise<void> {
    logger.log('🛠️  Setting up test data for birthday notifications...\n');

    try {
      // Get some existing users
      const users = await prisma.user.findMany({
        take: 3,
        where: { isActive: true },
        select: { id: true, fullName: true, email: true },
      });

      if (users.length < 2) {
        logger.error('❌ Need at least 2 users in database to setup test data');
        return;
      }

      const [userA, userB, userC] = users;

      // Set userA's birthday to 3 days from now
      const birthdayDate = new Date();
      birthdayDate.setDate(birthdayDate.getDate() + 3);
      birthdayDate.setFullYear(1990); // Set to past year

      await prisma.user.update({
        where: { id: userA.id },
        data: { dob: birthdayDate },
      });

      // Set referral relationships if we have enough users
      if (userB && userC) {
        // UserB refers UserA
        await prisma.user.update({
          where: { id: userA.id },
          data: { referrerId: userB.id },
        });

        // UserA refers UserC
        await prisma.user.update({
          where: { id: userC.id },
          data: { referrerId: userA.id },
        });
      }

      logger.log('✅ Test data setup completed:');
      logger.log(`  🎂 Birthday user: ${userA.fullName} (${userA.email})`);
      logger.log(`     Birthday date: ${birthdayDate.toISOString().split('T')[0]}`);
      if (userB) {
        logger.log(`  👤 Referrer: ${userB.fullName} (will receive notification)`);
      }
      if (userC) {
        logger.log(`  👤 Referral: ${userC.fullName} (will receive notification)`);
      }
      logger.log('\n💡 Now run: npm run test:birthday-notifications check');

    } catch (error) {
      logger.error('❌ Error setting up test data:', error);
    }
  }

  /**
   * Verify recent birthday notifications
   */
  async verifyNotifications(): Promise<void> {
    logger.log('🔍 Verifying recent birthday notifications...\n');

    try {
      // Get recent notifications related to birthdays
      const notifications = await prisma.notification.findMany({
        where: {
          message: { contains: 'sinh nhật' },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      logger.log(`📊 Found ${notifications.length} birthday notifications in the last 24 hours\n`);

      if (notifications.length === 0) {
        logger.log('⚠️  No birthday notifications found');
        logger.log('💡 Try running: npm run test:birthday-notifications trigger\n');
        return;
      }

      logger.log('📬 Recent birthday notifications:');
      notifications.forEach((notification, index) => {
        logger.log(`\n  ${index + 1}. To: ${notification.user.fullName} (${notification.user.email})`);
        logger.log(`     Message: ${notification.message}`);
        logger.log(`     Created: ${notification.createdAt.toISOString()}`);
        logger.log(`     Action: ${notification.action}`);
      });

    } catch (error) {
      logger.error('❌ Error verifying notifications:', error);
    }
  }

  /**
   * Calculate days until birthday
   */
  private calculateDaysUntilBirthday(dob: Date): number {
    const today = new Date();
    const currentYear = today.getFullYear();
    
    // Create birthday for current year
    const birthdayThisYear = new Date(currentYear, dob.getMonth(), dob.getDate());
    
    // If birthday already passed this year, calculate for next year
    if (birthdayThisYear < today) {
      birthdayThisYear.setFullYear(currentYear + 1);
    }
    
    // Calculate difference in days
    const diffTime = birthdayThisYear.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  /**
   * Display help information
   */
  displayHelp(): void {
    logger.log('🎂 Birthday Notification Test Script\n');
    logger.log('Usage: npx ts-node scripts/test-birthday-notifications.ts [action]\n');
    logger.log('Actions:');
    logger.log('  check   - Check users with upcoming birthdays');
    logger.log('  setup   - Setup test data (creates users with birthdays in 3 days)');
    logger.log('  verify  - Verify recent birthday notifications');
    logger.log('  help    - Show this help message\n');
    logger.log('Examples:');
    logger.log('  npx ts-node scripts/test-birthday-notifications.ts check');
    logger.log('  npx ts-node scripts/test-birthday-notifications.ts setup');
    logger.log('  npx ts-node scripts/test-birthday-notifications.ts verify\n');
    logger.log('Manual trigger (requires admin token):');
    logger.log('  curl -X POST http://localhost:3000/kyc-cron/trigger/birthday-notification \\');
    logger.log('    -H "Authorization: Bearer YOUR_ADMIN_TOKEN"');
  }

  async run(): Promise<void> {
    const action = process.argv[2] || 'help';

    try {
      switch (action) {
        case 'check':
          await this.checkUpcomingBirthdays();
          break;
        case 'setup':
          await this.setupTestData();
          break;
        case 'verify':
          await this.verifyNotifications();
          break;
        case 'help':
        default:
          this.displayHelp();
          break;
      }
    } catch (error) {
      logger.error('❌ Test failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  const tester = new BirthdayNotificationTester();
  tester.run();
}

export { BirthdayNotificationTester };
