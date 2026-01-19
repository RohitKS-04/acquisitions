# Docker Setup Guide

This guide explains how to run the Acquisitions application using Docker for both development and production environments.

## Prerequisites

- Docker and Docker Compose installed
- A [Neon](https://neon.tech) account with an existing project
- Neon API key (get from [API Keys settings](https://console.neon.tech/app/settings/api-keys))

## Quick Start

### Development (with Neon Local)

```bash
# 1. Copy and configure environment file
cp .env.development .env.development.local

# 2. Edit .env.development with your Neon credentials
# Required: NEON_API_KEY, NEON_PROJECT_ID, PARENT_BRANCH_ID

# 3. Start development environment
docker compose -f docker-compose.dev.yml up --build
```

### Production (with Neon Cloud)

```bash
# 1. Set your production DATABASE_URL
export DATABASE_URL="postgres://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"

# 2. Start production environment
docker compose -f docker-compose.prod.yml up --build -d
```

---

## Development Environment

The development setup uses **Neon Local**, a proxy that creates ephemeral database branches automatically.

### How It Works

1. When you run `docker compose -f docker-compose.dev.yml up`, Neon Local:
   - Creates a new ephemeral branch from your `PARENT_BRANCH_ID`
   - Exposes a local PostgreSQL endpoint at `neon-local:5432`
   - Automatically deletes the branch when the container stops

2. Your application connects to `postgres://neon:npg@neon-local:5432/neondb`

### Configuration

Edit `.env.development` with your Neon credentials:

```env
# Required - Get from Neon Console
NEON_API_KEY=your_neon_api_key_here
NEON_PROJECT_ID=your_neon_project_id_here
PARENT_BRANCH_ID=your_parent_branch_id_here

# Optional
DB_NAME=neondb
```

### Finding Your Neon IDs

| Variable           | Where to Find                                                       |
| ------------------ | ------------------------------------------------------------------- |
| `NEON_API_KEY`     | Neon Console → Settings → API Keys                                  |
| `NEON_PROJECT_ID`  | Neon Console → Project Settings → General                           |
| `PARENT_BRANCH_ID` | Neon Console → Project → Branches → Click branch → Copy ID from URL |

### Development Commands

```bash
# Start services
docker compose -f docker-compose.dev.yml up --build

# Start in background
docker compose -f docker-compose.dev.yml up --build -d

# View logs
docker compose -f docker-compose.dev.yml logs -f app

# Stop and remove containers (ephemeral branch is deleted)
docker compose -f docker-compose.dev.yml down

# Rebuild after dependency changes
docker compose -f docker-compose.dev.yml up --build --force-recreate
```

### Running Database Migrations

```bash
# Run migrations inside the app container
docker compose -f docker-compose.dev.yml exec app npm run db:migrate

# Generate new migrations
docker compose -f docker-compose.dev.yml exec app npm run db:generate
```

### Persistent Branches per Git Branch

To keep database branches across container restarts (useful for feature branch development):

1. Uncomment the volumes in `docker-compose.dev.yml`:

   ```yaml
   volumes:
     - ./.neon_local/:/tmp/.neon_local
     - ./.git/HEAD:/tmp/.git/HEAD:ro
   ```

2. Set `DELETE_BRANCH: false` in the environment

3. Add `.neon_local/` to your `.gitignore`

---

## Production Environment

Production connects directly to your Neon Cloud database—no local proxy.

### Configuration

Edit `.env.production` with your production database URL:

```env
DATABASE_URL=postgres://user:password@ep-xxx-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

**⚠️ Security Warning:** Never commit `.env.production` with real credentials. Use one of these approaches:

- Pass `DATABASE_URL` as an environment variable at runtime
- Use Docker secrets
- Use your platform's secret management (AWS Secrets Manager, Vault, etc.)

### Production Commands

```bash
# Build and start production container
docker compose -f docker-compose.prod.yml up --build -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Stop services
docker compose -f docker-compose.prod.yml down

# Check health
docker compose -f docker-compose.prod.yml ps
```

### Deployment with Environment Variables

```bash
# Pass DATABASE_URL at runtime (recommended)
DATABASE_URL="postgres://..." docker compose -f docker-compose.prod.yml up -d

# Or export first
export DATABASE_URL="postgres://..."
docker compose -f docker-compose.prod.yml up -d
```

---

## Environment Variables Reference

### Development (`.env.development`)

| Variable           | Description                            | Required |
| ------------------ | -------------------------------------- | -------- |
| `NEON_API_KEY`     | Neon API key for authentication        | Yes      |
| `NEON_PROJECT_ID`  | Your Neon project ID                   | Yes      |
| `PARENT_BRANCH_ID` | Branch to create ephemeral copies from | Yes      |
| `DB_NAME`          | Database name (default: `neondb`)      | No       |
| `PORT`             | Application port (default: `3000`)     | No       |
| `LOG_LEVEL`        | Logging level (default: `debug`)       | No       |

### Production (`.env.production`)

| Variable       | Description                        | Required |
| -------------- | ---------------------------------- | -------- |
| `DATABASE_URL` | Full Neon Cloud connection string  | Yes      |
| `PORT`         | Application port (default: `3000`) | No       |
| `LOG_LEVEL`    | Logging level (default: `info`)    | No       |

---

## Neon Serverless Driver Configuration

If you're using the `@neondatabase/serverless` driver with Neon Local, you may need to configure it for HTTP-based communication. Update `src/config/database.js`:

```javascript
import 'dotenv/config';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// Configure for Neon Local in development
const useNeonLocal = process.env.USE_NEON_LOCAL === 'true';
const neonLocalHost = process.env.NEON_LOCAL_HOST || 'neon-local';

if (useNeonLocal) {
  neonConfig.fetchEndpoint = `http://${neonLocalHost}:5432/sql`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.poolQueryViaFetch = true;
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

export { db, sql };
```

---

## Troubleshooting

### Neon Local container fails to start

- Verify your `NEON_API_KEY` is valid
- Check that `NEON_PROJECT_ID` matches your project
- Ensure `PARENT_BRANCH_ID` exists in your project

### Connection refused errors

- Wait for Neon Local health check to pass
- Check container logs: `docker compose -f docker-compose.dev.yml logs neon-local`

### SSL certificate errors

For JavaScript apps, you may need to add SSL configuration:

```javascript
const sql = neon(process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
});
```

### Docker on Mac with VirtioFS

If using Docker Desktop for Mac, switch VM settings from VirtioFS to gRPC FUSE for proper branch detection.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Development                               │
│  ┌─────────────┐     ┌──────────────┐     ┌──────────────┐ │
│  │    App      │────▶│  Neon Local  │────▶│  Neon Cloud  │ │
│  │  Container  │     │    Proxy     │     │  (Ephemeral  │ │
│  └─────────────┘     └──────────────┘     │   Branch)    │ │
│                                           └──────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Production                                │
│  ┌─────────────┐                          ┌──────────────┐ │
│  │    App      │─────────────────────────▶│  Neon Cloud  │ │
│  │  Container  │                          │  (Main DB)   │ │
│  └─────────────┘                          └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```
