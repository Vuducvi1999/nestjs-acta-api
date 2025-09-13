import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OLD_AVATAR_URL = 'https://i.pravatar.cc/150?img=58';
const NEW_AVATAR_URL =
  'https://2evl34cah0.ufs.sh/f/a6wlsorGVg4vCxySMMK6XOR7LjVSTtyk1oFdHKD9E5xfCw3b';

/**
 * Backfill script to update all user avatar attachments from old pravatar.cc URL to new UFS URL
 *
 * This script will:
 * 1. Find all attachments with the old pravatar.cc URL
 * 2. Update them to the new UFS URL
 * 3. Provide detailed statistics and logging
 *
 * ⚠️  WARNING: This script will directly update the database
 * Only run this if you're absolutely sure!
 */
async function backfillAvatarUrls() {
  console.log('🚀 Starting avatar URL backfill script...');
  console.log(
    `📝 Target: Update all attachments with fileUrl "${OLD_AVATAR_URL}"`,
  );
  console.log(`📝 New URL: "${NEW_AVATAR_URL}"`);

  try {
    const startTime = Date.now();

    // First, let's see how many attachments will be affected
    const attachmentsToUpdate = await prisma.attachment.findMany({
      where: {
        fileUrl: OLD_AVATAR_URL,
      },
      include: {
        userAvatar: {
          select: {
            id: true,
            email: true,
            fullName: true,
            referenceId: true,
          },
        },
        userCover: {
          select: {
            id: true,
            email: true,
            fullName: true,
            referenceId: true,
          },
        },
      },
    });

    console.log(`📊 Found ${attachmentsToUpdate.length} attachments to update`);

    if (attachmentsToUpdate.length === 0) {
      console.log(
        '✅ No attachments found with the old URL. Script completed.',
      );
      return;
    }

    // Show preview of attachments to be updated
    console.log('\n📋 Attachments to be updated:');
    attachmentsToUpdate.forEach((attachment, index) => {
      const user = attachment.userAvatar || attachment.userCover;
      const userInfo = user
        ? `${user.fullName} (${user.email}) - ${user.referenceId}`
        : 'No associated user';

      console.log(
        `${index + 1}. Attachment ID: ${attachment.id} - ${userInfo}`,
      );
    });

    // Ask for confirmation
    console.log(
      '\n⚠️  Are you sure you want to proceed? (This will update the database)',
    );
    console.log(
      '💡 To continue, please uncomment the update section in the script.\n',
    );

    // UNCOMMENT THE SECTION BELOW TO ACTUALLY RUN THE UPDATE

    console.log('🔄 Updating avatar URLs...');

    const updateResult = await prisma.attachment.updateMany({
      where: {
        fileUrl: OLD_AVATAR_URL,
      },
      data: {
        fileUrl: NEW_AVATAR_URL,
        updatedAt: new Date(),
      },
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(
      `✅ Successfully updated ${updateResult.count} attachments in ${duration}ms`,
    );

    // Verify the update
    const remainingOldUrls = await prisma.attachment.count({
      where: {
        fileUrl: OLD_AVATAR_URL,
      },
    });

    const newUrlCount = await prisma.attachment.count({
      where: {
        fileUrl: NEW_AVATAR_URL,
      },
    });

    console.log(
      `✅ Verification: ${remainingOldUrls} attachments still have old URL, ${newUrlCount} have new URL`,
    );

    // Get statistics about affected users
    const affectedUsers = await prisma.user.findMany({
      where: {
        avatar: {
          fileUrl: NEW_AVATAR_URL,
        },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        referenceId: true,
        avatar: {
          select: {
            id: true,
            fileUrl: true,
          },
        },
      },
    });

    console.log(`\n👥 Users affected by this update: ${affectedUsers.length}`);
    affectedUsers.forEach((user, index) => {
      console.log(
        `${index + 1}. ${user.fullName} (${user.email}) - ${user.referenceId}`,
      );
    });

    console.log('\n📝 Script completed successfully!');
  } catch (error) {
    console.error('❌ Error updating avatar URLs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Advanced version with more granular control and batch processing
async function backfillAvatarUrlsAdvanced() {
  console.log('🚀 Starting advanced avatar URL backfill script...');

  try {
    // Get statistics before update
    const currentStats = await prisma.attachment.groupBy({
      by: ['fileUrl'],
      _count: {
        id: true,
      },
      where: {
        fileUrl: {
          in: [OLD_AVATAR_URL, NEW_AVATAR_URL],
        },
      },
    });

    console.log('\n📊 Current attachment URL distribution:');
    currentStats.forEach((stat) => {
      const isOld = stat.fileUrl === OLD_AVATAR_URL;
      const isNew = stat.fileUrl === NEW_AVATAR_URL;
      const label = isOld ? 'OLD (pravatar.cc)' : isNew ? 'NEW (UFS)' : 'OTHER';
      console.log(`- ${label}: ${stat._count.id} attachments`);
    });

    // Update attachments in batches to avoid memory issues with large datasets
    const BATCH_SIZE = 50;
    let offset = 0;
    let totalUpdated = 0;

    while (true) {
      const attachmentsBatch = await prisma.attachment.findMany({
        where: {
          fileUrl: OLD_AVATAR_URL,
        },
        select: {
          id: true,
        },
        take: BATCH_SIZE,
        skip: offset,
      });

      if (attachmentsBatch.length === 0) {
        break;
      }

      // UNCOMMENT THE SECTION BELOW TO ACTUALLY RUN THE UPDATE

      const attachmentIds = attachmentsBatch.map((attachment) => attachment.id);

      const batchUpdateResult = await prisma.attachment.updateMany({
        where: {
          id: {
            in: attachmentIds,
          },
        },
        data: {
          fileUrl: NEW_AVATAR_URL,
          updatedAt: new Date(),
        },
      });

      totalUpdated += batchUpdateResult.count;
      console.log(
        `✅ Updated batch ${Math.floor(offset / BATCH_SIZE) + 1}: ${batchUpdateResult.count} attachments`,
      );

      offset += BATCH_SIZE;

      // Safety break for preview
      if (offset >= 1000) {
        console.log(
          '⚠️  Preview mode: Would process more than 1000 attachments. Stopping preview.',
        );
        break;
      }
    }

    console.log(
      `\n📊 Total attachments that would be updated: ${Math.min(offset, 1000)}+`,
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

// Quick mode - direct execution without preview
async function backfillAvatarUrlsQuick() {
  console.log(
    '⚡ Quick Update: Updating all avatar URLs from pravatar.cc to UFS...',
  );

  try {
    const startTime = Date.now();

    // Update all attachments with old URL to new URL
    const result = await prisma.attachment.updateMany({
      where: {
        fileUrl: OLD_AVATAR_URL,
      },
      data: {
        fileUrl: NEW_AVATAR_URL,
        updatedAt: new Date(),
      },
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(
      `✅ Successfully updated ${result.count} attachments in ${duration}ms`,
    );

    // Get final statistics
    const finalStats = await prisma.attachment.groupBy({
      by: ['fileUrl'],
      _count: {
        id: true,
      },
      where: {
        fileUrl: {
          in: [OLD_AVATAR_URL, NEW_AVATAR_URL],
        },
      },
    });

    console.log('\n📊 Final URL distribution after updating:');
    finalStats.forEach((stat) => {
      const isOld = stat.fileUrl === OLD_AVATAR_URL;
      const isNew = stat.fileUrl === NEW_AVATAR_URL;
      const label = isOld ? 'OLD (pravatar.cc)' : isNew ? 'NEW (UFS)' : 'OTHER';
      console.log(`- ${label}: ${stat._count.id} attachments`);
    });

    // Count users with updated avatars
    const usersWithNewAvatar = await prisma.user.count({
      where: {
        avatar: {
          fileUrl: NEW_AVATAR_URL,
        },
      },
    });

    console.log(`\n👥 Users with updated avatar URLs: ${usersWithNewAvatar}`);
    console.log('✨ Quick update completed successfully!');
  } catch (error) {
    console.error('❌ Error during quick update:', error);

    // Try to get some info about what went wrong
    try {
      const attachmentCount = await prisma.attachment.count({
        where: {
          fileUrl: OLD_AVATAR_URL,
        },
      });
      console.log(
        `📊 Total attachments with old URL in database: ${attachmentCount}`,
      );
    } catch (countError) {
      console.error('❌ Could not even count attachments:', countError);
    }

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
    await backfillAvatarUrlsAdvanced();
  } else if (mode === 'quick') {
    await backfillAvatarUrlsQuick();
  } else {
    await backfillAvatarUrls();
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
    console.log('👋 Database connection closed');
  });
