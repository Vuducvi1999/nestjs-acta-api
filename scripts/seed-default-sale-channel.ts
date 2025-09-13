#!/usr/bin/env ts-node

/**
 * Seed Default Sale Channel Script
 *
 * This script creates the default sale channel required for the checkout process.
 * Run this ONCE when setting up the e-commerce system.
 *
 * Usage:
 * npx ts-node scripts/seed-default-sale-channel.ts
 *
 * Or add to package.json scripts:
 * "seed:sale-channel": "ts-node scripts/seed-default-sale-channel.ts"
 */

import { PrismaClient, OriginSource } from '@prisma/client';

const prisma = new PrismaClient();

// Default sale channel configuration
const DEFAULT_SALE_CHANNEL = {
  name: 'Kênh bán hàng tự động của ACTA',
  isActive: true,
  img: 'https://2evl34cah0.ufs.sh/f/a6wlsorGVg4vCxySMMK6XOR7LjVSTtyk1oFdHKD9E5xfCw3b',
  isNotDelete: true,
  source: OriginSource.acta,
};

interface SeedResult {
  success: boolean;
  message: string;
  saleChannel?: any;
  created: boolean;
}

async function seedDefaultSaleChannel(): Promise<SeedResult> {
  console.log('🚀 Starting default sale channel seed...\n');

  try {
    // Check if default sale channel already exists
    const existingSaleChannel = await prisma.saleChannel.findFirst({
      where: {
        name: DEFAULT_SALE_CHANNEL.name,
      },
    });

    if (existingSaleChannel) {
      console.log('✅ Default sale channel already exists:');
      console.log(`   ID: ${existingSaleChannel.id}`);
      console.log(`   Name: ${existingSaleChannel.name}`);
      console.log(`   Active: ${existingSaleChannel.isActive}`);
      console.log(`   Created: ${existingSaleChannel.createdAt.toISOString()}`);

      return {
        success: true,
        message: 'Default sale channel already exists',
        saleChannel: existingSaleChannel,
        created: false,
      };
    }

    // Create default sale channel
    const saleChannel = await prisma.saleChannel.create({
      data: DEFAULT_SALE_CHANNEL,
    });

    console.log('✅ Default sale channel created successfully:');
    console.log(`   ID: ${saleChannel.id}`);
    console.log(`   Name: ${saleChannel.name}`);
    console.log(`   Active: ${saleChannel.isActive}`);
    console.log(`   Image: ${saleChannel.img}`);
    console.log(`   Created: ${saleChannel.createdAt.toISOString()}`);

    return {
      success: true,
      message: 'Default sale channel created successfully',
      saleChannel,
      created: true,
    };
  } catch (error) {
    console.error('❌ Error seeding default sale channel:', error);
    return {
      success: false,
      message: `Failed to seed default sale channel: ${error.message}`,
      created: false,
    };
  }
}

async function validateSeed(): Promise<void> {
  console.log('\n🔍 Validating seed results...');

  try {
    const saleChannels = await prisma.saleChannel.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`📊 Found ${saleChannels.length} active sale channels:`);
    saleChannels.forEach((channel, index) => {
      console.log(`   ${index + 1}. ${channel.name} (${channel.id})`);
    });

    const defaultChannel = saleChannels.find(
      (channel) => channel.name === DEFAULT_SALE_CHANNEL.name,
    );

    if (defaultChannel) {
      console.log('\n✅ Default sale channel validation successful');
      console.log(`   Default channel: ${defaultChannel.name}`);
      console.log(
        `   Status: ${defaultChannel.isActive ? 'Active' : 'Inactive'}`,
      );
    } else {
      console.log('\n⚠️  Default sale channel not found in active channels');
    }
  } catch (error) {
    console.error('❌ Validation failed:', error);
  }
}

async function main() {
  try {
    const result = await seedDefaultSaleChannel();

    if (result.success) {
      console.log(`\n📝 Summary: ${result.message}`);
      if (result.created) {
        console.log('🎉 Seed completed successfully!');
      } else {
        console.log('ℹ️  No changes needed');
      }
    } else {
      console.log(`\n💥 Seed failed: ${result.message}`);
      process.exit(1);
    }

    await validateSeed();

    console.log('\n📝 Next steps:');
    console.log('1. The default sale channel is now available for checkout');
    console.log('2. You can create additional sale channels as needed');
    console.log('3. The checkout helper will use this default channel');
  } catch (error) {
    console.error('\n💥 Seed script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run seed if this file is executed directly
if (require.main === module) {
  main();
}

export { seedDefaultSaleChannel, validateSeed };
