-- CreateTable
CREATE TABLE "user_settings" (
    "userId" TEXT NOT NULL,
    "locationName" TEXT,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "country" TEXT,
    "locationConsent" BOOLEAN NOT NULL DEFAULT false,
    "textSize" TEXT NOT NULL DEFAULT 'normal',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
