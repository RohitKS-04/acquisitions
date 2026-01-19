# syntax=docker/dockerfile:1

# ============================================
# Base stage - Common setup
# ============================================
FROM node:22-alpine AS base

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# ============================================
# Dependencies stage - Install all dependencies
# ============================================
FROM base AS deps

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# ============================================
# Production dependencies stage
# ============================================
FROM base AS prod-deps

COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# ============================================
# Development stage
# ============================================
FROM base AS development

ENV NODE_ENV=development

# Copy all dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Use dumb-init as PID 1
ENTRYPOINT ["dumb-init", "--"]

# Start in development mode with watch
CMD ["npm", "start"]

# ============================================
# Production stage
# ============================================
FROM base AS production

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy source code
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Use dumb-init as PID 1
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "src/index.js"]
