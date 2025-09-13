import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillClosureTable() {
  const users = await prisma.user.findMany({
    select: {
      referenceId: true,
      referrerId: true,
    },
  });

  const userMap = new Map(users.map((u) => [u.referenceId, u.referrerId]));

  const closures: {
    ancestorId: string;
    descendantId: string;
    depth: number;
  }[] = [];

  for (const user of users) {
    const refId = user.referenceId;
    closures.push({ ancestorId: refId, descendantId: refId, depth: 0 });

    let currentRef = user.referrerId;
    let depth = 1;

    while (currentRef && depth <= 10) {
      closures.push({
        ancestorId: currentRef,
        descendantId: refId,
        depth,
      });
      currentRef = userMap.get(currentRef) ?? null;
      depth++;
    }
  }

  // Optional: clear existing data
  await prisma.userReferralClosure.deleteMany();
  await prisma.userReferralClosure.createMany({ data: closures });

  console.log(`✅ Backfilled ${closures.length} closure rows`);
  await prisma.$disconnect();
}

backfillClosureTable().catch((err) => {
  console.error('❌ Error backfilling closure table:', err);
  process.exit(1);
});
