-- the 2048 best scores follow the account instead of a cookie in 1 browser. the old cookie scores
-- are not carried over, they were per browser and never verified
ALTER TABLE "user_settings" ADD COLUMN "best2048" JSONB NOT NULL DEFAULT '{}';
