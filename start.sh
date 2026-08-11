#!/bin/sh
set -e

echo "========================================"
echo "  查勘任务发布处理系统 - 启动中..."
echo "========================================"

# Check and create data directory
DATA_DIR="/app/data"
if [ ! -d "$DATA_DIR" ]; then
    echo "Creating data directory: $DATA_DIR"
    mkdir -p "$DATA_DIR"
fi

# Set default environment variables
: "${PORT:=3000}"
: "${JWT_SECRET:=change-this-secret-in-production}"
: "${ADMIN_PASSWORD:=admin123}"
: "${DB_PATH:=/app/data/survey.db}"
: "${AUTO_SAVE_INTERVAL:=5}"
: "${NODE_ENV:=production}"

export PORT JWT_SECRET ADMIN_PASSWORD DB_PATH AUTO_SAVE_INTERVAL NODE_ENV

echo "Configuration:"
echo "  PORT: $PORT"
echo "  DB_PATH: $DB_PATH"
echo "  AUTO_SAVE_INTERVAL: ${AUTO_SAVE_INTERVAL}s"
echo "  NODE_ENV: $NODE_ENV"
echo ""

# Start the application
echo "Starting Node.js application..."
exec node index.js
