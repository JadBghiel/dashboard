-- the yahoo login token table, unused since the market moved to finnhub
DROP TABLE "upstream_session";

-- saved widgets of the removed email checker, nothing renders them anymore
DELETE FROM "widget_instance" WHERE "serviceId" = 'tools' AND "widgetId" = 'email_checker';
