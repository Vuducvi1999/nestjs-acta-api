import { PrismaClient, Role, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Quick script to update all non-admin users to pending_kyc status
 * ⚠️  WARNING: This script will directly update the database without preview
 * Only run this if you're absolutely sure!
 */
async function quickUpdateUserStatus() {
  console.log('⚡ Quick Update: Setting all non-admin users to pending_kyc...');

  try {
    const startTime = Date.now();

    // Update all non-admin ACTIVE users to pending_kyc
    const result = await prisma.user.updateMany({
      where: {
        role: {
          not: Role.admin,
        },
        status: UserStatus.active, // Only update ACTIVE users
      },
      data: {
        status: UserStatus.pending_kyc,
        updatedAt: new Date(),
      },
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(
      `✅ Successfully updated ${result.count} users in ${duration}ms`,
    );

    // Get final statistics
    const finalStats = await prisma.user.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
      where: {
        role: {
          not: Role.admin,
        },
      },
    });

    console.log('\n📊 Final status distribution after updating ACTIVE users:');
    finalStats.forEach((stat) => {
      console.log(`- ${stat.status}: ${stat._count.id} users`);
    });

    // Specific count for pending_kyc
    const pendingKycCount = await prisma.user.count({
      where: {
        role: {
          not: Role.admin,
        },
        status: UserStatus.pending_kyc,
      },
    });

    console.log(
      `\n🎯 Total non-admin users with pending_kyc status: ${pendingKycCount}`,
    );
    console.log('✨ Quick update completed successfully!');
  } catch (error) {
    console.error('❌ Error during quick update:', error);

    // Try to get some info about what went wrong
    try {
      const userCount = await prisma.user.count({
        where: {
          role: {
            not: Role.admin,
          },
        },
      });
      console.log(`📊 Total non-admin users in database: ${userCount}`);
    } catch (countError) {
      console.error('❌ Could not even count users:', countError);
    }

    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
quickUpdateUserStatus()
  .catch((e) => {
    console.error('💥 Quick update script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('👋 Database connection closed');
  });
