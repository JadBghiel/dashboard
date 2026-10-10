-- AlterTable
ALTER TABLE "user_settings" ALTER COLUMN "locationConsent" DROP NOT NULL,
ALTER COLUMN "locationConsent" DROP DEFAULT;
