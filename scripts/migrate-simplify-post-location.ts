import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateSimplifyPostLocation() {
  try {
    console.log('Starting PostLocation table simplification...');

    // Drop the old indexes first
    await prisma.$executeRaw`DROP INDEX IF EXISTS "post_locations_name_idx"`;
    await prisma.$executeRaw`DROP INDEX IF EXISTS "post_locations_latitude_longitude_idx"`;

    // Remove the columns
    await prisma.$executeRaw`ALTER TABLE "post_locations" DROP COLUMN IF EXISTS "name"`;
    await prisma.$executeRaw`ALTER TABLE "post_locations" DROP COLUMN IF EXISTS "latitude"`;
    await prisma.$executeRaw`ALTER TABLE "post_locations" DROP COLUMN IF EXISTS "longitude"`;

    console.log('PostLocation table simplified successfully!');
    console.log('Remaining columns: id, address, postId, createdAt, updatedAt');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateSimplifyPostLocation();
