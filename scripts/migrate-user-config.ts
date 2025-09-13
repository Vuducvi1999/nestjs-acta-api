#!/usr/bin/env ts-node

/**
 * Production User Config Migration Script
 * 
 * This script migrates existing users to have the new avatar_posts configuration.
 * Run this ONCE when deploying the avatar posts feature to production.
 * 
 * Usage:
 * npx ts-node scripts/migrate-user-config.ts
 * 
 * Or add to package.json scripts:
 * "migrate:user-config": "ts-node scripts/migrate-user-config.ts"
 */

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default avatar posts configuration
const DEFAULT_AVATAR_POSTS_CONFIG = {
  enabled: true,
  postType: 'simple',
  autoPublish: true,
  customMessage: null,
  notifyFollowers: true,
  includeComparison: false,
};

// Default user configuration template
const DEFAULT_USER_CONFIG = {
  language: 'vi',
  avatar_posts: DEFAULT_AVATAR_POSTS_CONFIG,
  payment_methods: [],
  profile_privacy: 'private',
  security_settings: { twoFA: false },
  email_subscription: true,
  shipping_preferences: {},
  information_publicity: 'private',
  notification_settings: { sms: true, push: true },
};

interface MigrationStats {
  totalUsers: number;
  usersWithConfig: number;
  usersWithoutConfig: number;
  configsUpdated: number;
  configsCreated: number;
  errors: number;
  errorDetails: string[];
}

async function migrateUserConfigs(): Promise<MigrationStats> {
  console.log('🚀 Starting user config migration for avatar posts...\n');

  const stats: MigrationStats = {
    totalUsers: 0,
    usersWithConfig: 0,
    usersWithoutConfig: 0,
    configsUpdated: 0,
    configsCreated: 0,
    errors: 0,
    errorDetails: [],
  };

  try {
    // Get all users
    const users = await prisma.user.findMany({
      include: {
        userConfig: true,
      },
    });

    stats.totalUsers = users.length;
    console.log(`📊 Found ${stats.totalUsers} users to process\n`);

    // Process users in batches
    const batchSize = 50;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(users.length / batchSize)} (${batch.length} users)`);

      for (const user of batch) {
        try {
          if (user.userConfig) {
            // User has existing config - update it
            stats.usersWithConfig++;
            const currentConfig = user.userConfig.config as Record<string, any> || {};
            
            // Check if avatar_posts already exists
            if (!currentConfig.avatar_posts) {
              // Add avatar_posts to existing config
              const updatedConfig = {
                ...currentConfig,
                avatar_posts: DEFAULT_AVATAR_POSTS_CONFIG,
              };

              await prisma.userConfig.update({
                where: { userId: user.id },
                data: { config: updatedConfig },
              });

              stats.configsUpdated++;
              console.log(`  ✅ Updated config for user ${user.id} (${user.fullName})`);
            } else {
              console.log(`  ⏭️  User ${user.id} already has avatar_posts config`);
            }
          } else {
            // User has no config - create new one
            stats.usersWithoutConfig++;
            
            await prisma.userConfig.create({
              data: {
                userId: user.id,
                config: DEFAULT_USER_CONFIG,
              },
            });

            stats.configsCreated++;
            console.log(`  ✅ Created config for user ${user.id} (${user.fullName})`);
          }
        } catch (error) {
          stats.errors++;
          const errorMsg = `Error processing user ${user.id}: ${error.message}`;
          stats.errorDetails.push(errorMsg);
          console.log(`  ❌ ${errorMsg}`);
        }
      }

      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < users.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return stats;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function validateMigration(): Promise<void> {
  console.log('\n🔍 Validating migration results...');

  try {
    // Check users without avatar_posts config
    const usersWithoutAvatarPosts = await prisma.userConfig.findMany({
      where: {
        OR: [
          { config: { path: ['avatar_posts'], equals: Prisma.JsonNull } },
          { config: { not: { path: ['avatar_posts'] } } },
        ],
      },
      include: { user: true },
    });

    if (usersWithoutAvatarPosts.length > 0) {
      console.log(`⚠️  Found ${usersWithoutAvatarPosts.length} users still missing avatar_posts config:`);
      usersWithoutAvatarPosts.forEach(config => {
        console.log(`  - User ${config.userId} (${config.user.fullName})`);
      });
    } else {
      console.log('✅ All users have avatar_posts configuration');
    }

    // Check total users with configs
    const totalUsersWithConfig = await prisma.userConfig.count();
    const totalUsers = await prisma.user.count();
    
    console.log(`📊 Migration validation:`);
    console.log(`  - Total users: ${totalUsers}`);
    console.log(`  - Users with config: ${totalUsersWithConfig}`);
    console.log(`  - Coverage: ${((totalUsersWithConfig / totalUsers) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ Validation failed:', error);
  }
}

async function main() {
  try {
    const stats = await migrateUserConfigs();
    
    console.log('\n📊 Migration Summary:');
    console.log(`  Total users processed: ${stats.totalUsers}`);
    console.log(`  Users with existing config: ${stats.usersWithConfig}`);
    console.log(`  Users without config: ${stats.usersWithoutConfig}`);
    console.log(`  Configs updated: ${stats.configsUpdated}`);
    console.log(`  Configs created: ${stats.configsCreated}`);
    console.log(`  Errors: ${stats.errors}`);

    if (stats.errors > 0) {
      console.log('\n❌ Errors encountered:');
      stats.errorDetails.forEach(error => console.log(`  - ${error}`));
    }

    await validateMigration();

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Verify the migration results in your database');
    console.log('2. Test avatar updates to ensure posts are created');
    console.log('3. Monitor application logs for any issues');
    console.log('4. Users can now configure avatar posts in their profile settings');

  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  main();
}

export { migrateUserConfigs, validateMigration };
