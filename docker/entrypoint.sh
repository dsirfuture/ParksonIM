#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required"
  exit 1
fi

DB_HOST="${POSTGRES_HOST:-parksonim-db}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-parksonim}"
DB_USER="${POSTGRES_USER:-parksonim}"

echo "Waiting for PostgreSQL..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
  sleep 2
done

echo "Generating Prisma client..."
npx prisma generate >/dev/null

echo "Syncing schema to isolated ParksonIM database..."
if ! npx prisma db push --skip-generate; then
  echo "Prisma db push skipped because the existing database has extra columns or data-loss warnings."
  echo "Continuing to start the app without applying destructive schema changes."
fi

exec "$@"
