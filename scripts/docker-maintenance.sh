#!/usr/bin/env bash

set -euo pipefail

echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] Starting Docker maintenance"
echo "[before] disk usage"
df -h /
echo "[before] docker usage"
docker system df || true

# Remove images that are no longer used by any container.
docker image prune -af

# Clear old build cache to prevent Next.js image builds from filling the disk.
docker builder prune -af --filter "until=168h"

echo "[after] disk usage"
df -h /
echo "[after] docker usage"
docker system df || true
echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] Docker maintenance finished"
