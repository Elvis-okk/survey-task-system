FROM node:18-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy package.json and package-lock.json first for Docker cache
COPY server/package.json server/package-lock.json* ./

# Install production dependencies with China mirror
RUN npm install --production --registry=https://registry.npmmirror.com

# Copy backend code (includes public frontend files)
COPY server/ ./

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Create data directory
RUN mkdir -p /app/data

# Set default environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    JWT_SECRET=change-this-secret-in-production \
    ADMIN_PASSWORD=admin123 \
    DB_PATH=/app/data/survey.db \
    AUTO_SAVE_INTERVAL=5

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/auth/login || exit 1

# Data volume mount point
VOLUME ["/app/data"]

# Use dumb-init as PID 1 for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start application via startup script
CMD ["/app/start.sh"]
