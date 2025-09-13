-- AlterTable
ALTER TABLE "payment" ALTER COLUMN "expiresAt" SET DEFAULT (timezone('utc'::text, now()) + '5 minutes'::interval);
