-- crypto and the currency converter left the finnhub "market" service for a keyless "currencies" one,
-- so a missing finnhub key only locks the stocks. the saved widgets follow, w/ their settings
UPDATE "widget_instance" SET "serviceId" = 'currencies'
WHERE "serviceId" = 'market' AND "widgetId" IN ('crypto_prices', 'currency_converter');
