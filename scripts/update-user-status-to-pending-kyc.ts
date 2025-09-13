import { PrismaClient, Role, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function updateUserStatusToPendingKYC() {
  console.log('🚀 Starting user status update script...');

  try {
    // First, let's see how many users will be affected
    const usersToUpdate = await prisma.user.findMany({
      where: {
        role: {
          not: Role.admin,
        },
        status: UserStatus.active, // Only update ACTIVE users
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
      },
    });

    console.log(`📊 Found ${usersToUpdate.length} non-admin users to update`);

    if (usersToUpdate.length === 0) {
      console.log('✅ No users to update. Script completed.');
      return;
    }

    // Show preview of users to be updated
    console.log('\n📋 Users to be updated:');
    usersToUpdate.forEach((user, index) => {
      console.log(
        `${index + 1}. ${user.fullName} (${user.email}) - Current status: ${user.status} → pending_kyc`,
      );
    });

    // Ask for confirmation (comment this out if you want to run without confirmation)
    console.log(
      '\n⚠️  Are you sure you want to proceed? (This will update the database)',
    );
    console.log(
      '💡 To continue, please uncomment the update section in the script.\n',
    );

    // UNCOMMENT THE SECTION BELOW TO ACTUALLY RUN THE UPDATE

    console.log('🔄 Updating user statuses...');

    const updateResult = await prisma.user.updateMany({
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

    console.log(
      `✅ Successfully updated ${updateResult.count} users to pending_kyc status`,
    );

    // Verify the update
    const updatedUsers = await prisma.user.count({
      where: {
        role: {
          not: Role.admin,
        },
        status: UserStatus.pending_kyc,
      },
    });

    console.log(
      `✅ Verification: ${updatedUsers} non-admin users now have pending_kyc status`,
    );

    console.log('\n📝 Script completed successfully!');
  } catch (error) {
    console.error('❌ Error updating user statuses:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Advanced version with more granular control
async function updateUserStatusToPendingKYCAdvanced() {
  console.log('🚀 Starting advanced user status update script...');

  try {
    // Get statistics before update
    const currentStats = await prisma.user.groupBy({
      by: ['status', 'role'],
      _count: {
        id: true,
      },
      where: {
        role: {
          not: Role.admin,
        },
        status: UserStatus.active, // Only show ACTIVE users stats
      },
    });

    console.log('\n📊 Current status distribution for non-admin users:');
    currentStats.forEach((stat) => {
      console.log(
        `- ${stat.role} with ${stat.status}: ${stat._count.id} users`,
      );
    });

    // Update users in batches to avoid memory issues with large datasets
    const BATCH_SIZE = 100;
    let offset = 0;
    let totalUpdated = 0;

    while (true) {
      const usersBatch = await prisma.user.findMany({
        where: {
          role: {
            not: Role.admin,
          },
          status: UserStatus.active, // Only process ACTIVE users
        },
        select: {
          id: true,
        },
        take: BATCH_SIZE,
        skip: offset,
      });

      if (usersBatch.length === 0) {
        break;
      }

      // UNCOMMENT THE SECTION BELOW TO ACTUALLY RUN THE UPDATE

      const userIds = usersBatch.map((user) => user.id);

      const batchUpdateResult = await prisma.user.updateMany({
        where: {
          id: {
            in: userIds,
          },
        },
        data: {
          status: UserStatus.pending_kyc,
          updatedAt: new Date(),
        },
      });

      totalUpdated += batchUpdateResult.count;
      console.log(
        `✅ Updated batch ${Math.floor(offset / BATCH_SIZE) + 1}: ${batchUpdateResult.count} users`,
      );

      offset += BATCH_SIZE;

      // Safety break for preview
      if (offset >= 1000) {
        console.log(
          '⚠️  Preview mode: Would process more than 1000 users. Stopping preview.',
        );
        break;
      }
    }

    console.log(
      `\n📊 Total users that would be updated: ${Math.min(offset, 1000)}+`,
    );
    console.log(
      '\n💡 To run the actual update, uncomment the update sections in the script.',
    );
  } catch (error) {
    console.error('❌ Error in advanced update script:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'simple';

  if (mode === 'advanced') {
    await updateUserStatusToPendingKYCAdvanced();
  } else {
    await updateUserStatusToPendingKYC();
  }
}

// Run the script
main()
  .catch((e) => {
    console.error('❌ Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
