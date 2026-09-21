#!/bin/sh
# migrating then hand pid 1 to the server
set -e

echo "> prisma migrate deploy"
node node_modules/prisma/build/index.js migrate deploy

echo "> next server on ${PORT}"
exec node server.js
