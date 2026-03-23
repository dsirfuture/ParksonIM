# ParksonIM

ParksonIM is a Next.js + Prisma + PostgreSQL application for ParksonMX business workflows, including receipts, billing, and dropshipping operations.

## Local Development

### Prerequisites

- Node.js 20+
- npm
- PostgreSQL 16 locally, or Docker Desktop

### Local environment

1. Copy the example file and adjust values if needed:
   `copy .env.local.example .env.local`
2. Install dependencies:
   `npm install`
3. Generate Prisma client:
   `npx prisma generate`
4. Push schema to your local database:
   `npx prisma db push`
5. Start the development server:
   `npm run dev`

Default local URL:
- `http://localhost:3000`

## Local Docker Compose

For local containerized development, use the local override file:

```bash
docker compose -f compose.yaml -f compose.local.yaml --env-file .env.local up --build
```

This keeps local development pointed at local-safe environment variables instead of production values.

## Production Deployment

Production deployment uses Docker Compose and the server's own `.env`.

Typical production flow:

```bash
git pull origin main
docker compose build --pull
docker compose up -d
```

An example deployment helper is included at:
- `scripts/deploy-production.sh`

## Included deployment files

- `compose.yaml`: production compose stack
- `compose.local.yaml`: local-only compose override
- `.env.local.example`: safe local environment example
- `scripts/deploy-production.sh`: production deployment helper
- `scripts/docker-maintenance.sh`: Docker cleanup helper

## Server Maintenance

- Docker cleanup script:
  `scripts/docker-maintenance.sh`
- Recommended cron entry:
  `20 4 * * * /opt/stacks/parksonim/scripts/docker-maintenance.sh >> /var/log/parksonim_docker_cleanup.log 2>&1`
