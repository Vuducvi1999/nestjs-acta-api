import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupOrphanedPosts() {
  console.log('🔍 Starting cleanup of orphaned posts...');

  try {
    // Find posts with deleted users
    const postsWithDeletedUsers = await prisma.post.findMany({
      where: {
        user: {
          deletedAt: {
            not: null,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            deletedAt: true,
          },
        },
      },
    });

    console.log(
      `📊 Found ${postsWithDeletedUsers.length} posts with deleted users`,
    );

    if (postsWithDeletedUsers.length > 0) {
      console.log('🗑️  Deleting posts with deleted users...');

      const deletedPostIds = postsWithDeletedUsers.map((post) => post.id);

      // Delete posts with deleted users
      const deleteResult = await prisma.post.deleteMany({
        where: {
          id: {
            in: deletedPostIds,
          },
        },
      });

      console.log(
        `✅ Successfully deleted ${deleteResult.count} orphaned posts`,
      );

      // Log details for audit
      postsWithDeletedUsers.forEach((post) => {
        console.log(
          `   - Post ID: ${post.id}, User: ${post.user.fullName} (deleted at: ${post.user.deletedAt})`,
        );
      });
    }

    // Note: Posts with null userId shouldn't exist due to foreign key constraints
    // If they do exist, they would cause foreign key constraint violations
    console.log(
      'ℹ️  Skipping check for posts with null users (not possible with foreign key constraints)',
    );

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupOrphanedPosts()
  .then(() => {
    console.log('🎉 Cleanup script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Cleanup script failed:', error);
    process.exit(1);
  });
