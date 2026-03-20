#!/usr/bin/env bash

set -euo pipefail

echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] Starting Docker maintenance"
echo "[before] disk usage"
df -h /
echo "[before] docker usage"
docker system df || true

# Keep only the latest 5000 sync logs to avoid unbounded growth.
if docker ps --format '{{.Names}}' | grep -qx 'parksonim-db'; then
  echo "[maintenance] pruning yogo_product_sync_logs to latest 5000 rows"
  docker exec parksonim-db psql -U parksonim -d parksonim -c "
    WITH keep AS (
      SELECT id
      FROM \"yogo_product_sync_logs\"
      ORDER BY created_at DESC, id DESC
      LIMIT 5000
    )
    DELETE FROM \"yogo_product_sync_logs\"
    WHERE id NOT IN (SELECT id FROM keep);
  " >/dev/null
  docker exec parksonim-db vacuumdb -U parksonim -d parksonim --analyze-in-stages >/dev/null
fi

# Remove images that are no longer used by any container.
docker image prune -af

# Clear old build cache to prevent Next.js image builds from filling the disk.
docker builder prune -af --filter "until=168h"

echo "[after] disk usage"
df -h /
echo "[after] docker usage"
docker system df || true
echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] Docker maintenance finished"
