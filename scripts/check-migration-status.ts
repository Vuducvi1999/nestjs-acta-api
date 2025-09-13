#!/usr/bin/env ts-node

/**
 * Check Migration Status Script
 *
 * This script checks the current state of user configs without making any changes.
 * Use this to verify if migration is needed or to check migration results.
 *
 * Usage:
 * npx ts-node scripts/check-migration-status.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface StatusReport {
  totalUsers: number;
  usersWithConfig: number;
  usersWithoutConfig: number;
  usersWithAvatarPosts: number;
  usersWithoutAvatarPosts: number;
  migrationNeeded: boolean;
  sampleConfigs: any[];
}

async function checkMigrationStatus(): Promise<StatusReport> {
  console.log('🔍 Checking user config migration status...\n');

  try {
    // Get total users
    const totalUsers = await prisma.user.count();

    // Get users with configs
    const usersWithConfig = await prisma.userConfig.count();

    // Get users with avatar_posts config
    const usersWithAvatarPosts = await prisma.userConfig.count({
      where: {
        config: {
          path: ['avatar_posts'],
          not: Prisma.JsonNull,
        },
      },
    });

    // Get sample configs
    const sampleConfigs = await prisma.userConfig.findMany({
      take: 3,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    const report: StatusReport = {
      totalUsers,
      usersWithConfig,
      usersWithoutConfig: totalUsers - usersWithConfig,
      usersWithAvatarPosts,
      usersWithoutAvatarPosts: usersWithConfig - usersWithAvatarPosts,
      migrationNeeded: usersWithAvatarPosts < totalUsers,
      sampleConfigs: sampleConfigs.map((config) => ({
        userId: config.userId,
        userName: config.user.fullName,
        userEmail: config.user.email,
        hasAvatarPosts: !!(config.config as any)?.avatar_posts,
        config: config.config,
      })),
    };

    return report;
  } catch (error) {
    console.error('❌ Error checking migration status:', error);
    throw error;
  }
}

async function displayReport(report: StatusReport) {
  console.log('📊 Migration Status Report');
  console.log('='.repeat(50));

  console.log(`\n👥 User Statistics:`);
  console.log(`  Total users: ${report.totalUsers}`);
  console.log(`  Users with config: ${report.usersWithConfig}`);
  console.log(`  Users without config: ${report.usersWithoutConfig}`);

  console.log(`\n🎭 Avatar Posts Configuration:`);
  console.log(
    `  Users with avatar_posts config: ${report.usersWithAvatarPosts}`,
  );
  console.log(
    `  Users without avatar_posts config: ${report.usersWithoutAvatarPosts}`,
  );

  const coveragePercent =
    report.totalUsers > 0
      ? ((report.usersWithAvatarPosts / report.totalUsers) * 100).toFixed(1)
      : '0';
  console.log(`  Coverage: ${coveragePercent}%`);

  console.log(`\n🚀 Migration Status:`);
  if (report.migrationNeeded) {
    console.log(`  ⚠️  Migration NEEDED`);
    console.log(
      `  📝 ${report.totalUsers - report.usersWithAvatarPosts} users need avatar_posts config`,
    );
    console.log(`\n💡 To run migration:`);
    console.log(`  npm run migrate:user-config`);
  } else {
    console.log(`  ✅ Migration COMPLETE`);
    console.log(`  🎉 All users have avatar_posts configuration`);
  }

  if (report.sampleConfigs.length > 0) {
    console.log(`\n📋 Sample Configurations:`);
    report.sampleConfigs.forEach((sample, index) => {
      console.log(
        `\n  ${index + 1}. User: ${sample.userName} (${sample.userId})`,
      );
      console.log(`     Email: ${sample.userEmail}`);
      console.log(
        `     Has avatar_posts: ${sample.hasAvatarPosts ? '✅' : '❌'}`,
      );
      if (sample.hasAvatarPosts) {
        const avatarConfig = sample.config?.avatar_posts;
        console.log(
          `     Avatar posts enabled: ${avatarConfig?.enabled ? '✅' : '❌'}`,
        );
        console.log(`     Post type: ${avatarConfig?.postType || 'N/A'}`);
        console.log(
          `     Auto publish: ${avatarConfig?.autoPublish ? '✅' : '❌'}`,
        );
      }
    });
  }
}

async function main() {
  try {
    const report = await checkMigrationStatus();
    await displayReport(report);

    console.log('\n' + '='.repeat(50));
    console.log('✅ Status check completed successfully!');
  } catch (error) {
    console.error('\n💥 Status check failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

export { checkMigrationStatus };
