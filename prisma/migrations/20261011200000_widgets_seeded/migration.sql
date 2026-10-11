-- the default widgets are given once. a user who already has widgets got theirs, so removing them
-- all later leaves an empty dashboard instead of the 16 defaults again
ALTER TABLE "user_settings" ADD COLUMN "widgetsSeeded" BOOLEAN NOT NULL DEFAULT false;

INSERT INTO "user_settings" ("userId", "widgetsSeeded", "updatedAt")
SELECT DISTINCT "userId", true, NOW() FROM "widget_instance"
ON CONFLICT ("userId") DO UPDATE SET "widgetsSeeded" = true;
