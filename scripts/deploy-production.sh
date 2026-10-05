#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] Starting production deploy"

if [ ! -f .env ]; then
  echo ".env not found in project root"
  exit 1
fi

git fetch origin main
git pull --ff-only origin main

docker compose build --pull
docker compose up -d

echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] Production deploy finished"
