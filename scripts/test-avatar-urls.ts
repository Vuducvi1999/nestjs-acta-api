import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OLD_AVATAR_URL = 'https://i.pravatar.cc/150?img=58';
const NEW_AVATAR_URL =
  'https://2evl34cah0.ufs.sh/f/a6wlsorGVg4vCxySMMK6XOR7LjVSTtyk1oFdHKD9E5xfCw3b';

/**
 * Test script to verify avatar URL backfill functionality
 * This script will:
 * 1. Check current avatar URL distribution
 * 2. Verify the target URLs exist
 * 3. Show affected users
 * 4. Provide recommendations
 */
async function testAvatarUrls() {
  console.log('🧪 Testing avatar URL backfill functionality...');
  console.log(`📝 Old URL: "${OLD_AVATAR_URL}"`);
  console.log(`📝 New URL: "${NEW_AVATAR_URL}"`);

  try {
    // Check current attachment URL distribution
    const attachmentStats = await prisma.attachment.groupBy({
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
    attachmentStats.forEach((stat) => {
      const isOld = stat.fileUrl === OLD_AVATAR_URL;
      const isNew = stat.fileUrl === NEW_AVATAR_URL;
      const label = isOld ? 'OLD (pravatar.cc)' : isNew ? 'NEW (UFS)' : 'OTHER';
      console.log(`- ${label}: ${stat._count.id} attachments`);
    });

    // Check users with old avatar URLs
    const usersWithOldAvatar = await prisma.user.findMany({
      where: {
        avatar: {
          fileUrl: OLD_AVATAR_URL,
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

    console.log(
      `\n👥 Users with old avatar URLs: ${usersWithOldAvatar.length}`,
    );
    if (usersWithOldAvatar.length > 0) {
      console.log('📋 Affected users:');
      usersWithOldAvatar.forEach((user, index) => {
        console.log(
          `${index + 1}. ${user.fullName} (${user.email}) - ${user.referenceId}`,
        );
      });
    }

    // Check users with new avatar URLs
    const usersWithNewAvatar = await prisma.user.findMany({
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

    console.log(
      `\n✅ Users with new avatar URLs: ${usersWithNewAvatar.length}`,
    );
    if (usersWithNewAvatar.length > 0) {
      console.log('📋 Users with new avatars:');
      usersWithNewAvatar.forEach((user, index) => {
        console.log(
          `${index + 1}. ${user.fullName} (${user.email}) - ${user.referenceId}`,
        );
      });
    }

    // Check total attachments with old URL
    const totalOldAttachments = await prisma.attachment.count({
      where: {
        fileUrl: OLD_AVATAR_URL,
      },
    });

    // Check total attachments with new URL
    const totalNewAttachments = await prisma.attachment.count({
      where: {
        fileUrl: NEW_AVATAR_URL,
      },
    });

    console.log('\n📈 Summary:');
    console.log(`- Total attachments with old URL: ${totalOldAttachments}`);
    console.log(`- Total attachments with new URL: ${totalNewAttachments}`);
    console.log(`- Users affected by old URL: ${usersWithOldAvatar.length}`);
    console.log(`- Users with new URL: ${usersWithNewAvatar.length}`);

    // Recommendations
    console.log('\n💡 Recommendations:');
    if (totalOldAttachments > 0) {
      console.log(`✅ Found ${totalOldAttachments} attachments to update`);
      console.log('✅ Ready to run backfill script');
      console.log('📝 Command: npm run backfill:avatar-urls');
    } else {
      console.log('✅ No attachments found with old URL');
      console.log('✅ No action needed');
    }

    if (usersWithOldAvatar.length > 0) {
      console.log(`⚠️  ${usersWithOldAvatar.length} users will be affected`);
      console.log('📝 Consider notifying users about avatar updates');
    }

    console.log('\n🧪 Test completed successfully!');
  } catch (error) {
    console.error('❌ Error during test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testAvatarUrls()
  .catch((e) => {
    console.error('💥 Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('👋 Database connection closed');
  });
