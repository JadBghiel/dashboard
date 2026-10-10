-- the cross now deletes a widget instead of hiding it. a widget hidden before stays off the dashboard
DELETE FROM "widget_instance" WHERE "hidden" = true;

ALTER TABLE "widget_instance" DROP COLUMN "hidden";
