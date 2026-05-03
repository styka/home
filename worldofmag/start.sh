#!/bin/sh
set -e

echo "Waiting for database to wake up..."
for i in 1 2 3 4 5; do
  if npx prisma migrate deploy; then
    echo "Migrations applied successfully."
    break
  fi
  if [ $i -eq 5 ]; then
    echo "Migration failed after 5 attempts. Exiting."
    exit 1
  fi
  echo "Migration attempt $i failed (Neon may be waking up). Retrying in 8s..."
  sleep 8
done

exec node_modules/.bin/next start
