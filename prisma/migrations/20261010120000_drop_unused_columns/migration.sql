-- service subscriptions were never used: a saved key (credential) or a linked account (better-auth)
-- already says the user subscribed to a service, a 2nd table would have to be kept in sync w/ them
ALTER TABLE "service_subscription" DROP CONSTRAINT "service_subscription_accountId_fkey";
ALTER TABLE "service_subscription" DROP CONSTRAINT "service_subscription_userId_fkey";
DROP TABLE "service_subscription";
DROP TYPE "subscription_status";

-- widget sizes were never used, the dashboard grid places each card itself
ALTER TABLE "widget_instance" DROP COLUMN "size";
