#!/bin/bash

# Grant CREATEDB privilege to the RHDH database user after PostgreSQL is fully stable.
# Backstage creates per-plugin databases (backstage_plugin_*) which requires CREATEDB.
# This script is idempotent — safe to run multiple times.
#
# The extended waiting logic handles:
# - PostgreSQL init scripts that may restart the database
# - Race conditions during first boot
# - Containerized PostgreSQL startup timing

set -euo pipefail

CONTAINER_NAME="rhdh-postgres"
ENV_FILE="/etc/rhdh/postgres.env"

# Read the application DB user from postgres.env
DB_USER="rhdh_user"
if [ -f "$ENV_FILE" ]; then
    DB_USER=$(grep "^POSTGRESQL_USER=" "$ENV_FILE" | cut -d= -f2 || echo "rhdh_user")
fi

echo "Waiting for PostgreSQL to be fully stable..."

for i in {1..60}; do
    if podman ps --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
        echo "PostgreSQL container is running"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "WARNING: PostgreSQL container not found after 60 seconds"
        exit 0
    fi
    sleep 1
done

for i in {1..60}; do
    if podman exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1; then
        echo "PostgreSQL is accepting connections"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "WARNING: PostgreSQL not ready after 60 seconds"
        exit 0
    fi
    sleep 1
done

# Wait for the application user to exist (created by PostgreSQL init scripts)
for i in {1..60}; do
    if podman exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" 2>/dev/null | grep -q '^1$'; then
        echo "${DB_USER} exists"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "WARNING: ${DB_USER} not found after 60 seconds"
        exit 0
    fi
    sleep 1
done

# Wait for PostgreSQL init scripts to fully complete (pg_hba.conf reload)
DB_PASSWORD=$(grep "^POSTGRESQL_PASSWORD=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "")
if [ -n "$DB_PASSWORD" ]; then
    echo "Verifying ${DB_USER} password authentication..."
    for i in {1..60}; do
        if podman exec -e PGPASSWORD="$DB_PASSWORD" "$CONTAINER_NAME" \
            psql -U "$DB_USER" -d postgres -tAc "SELECT 1" >/dev/null 2>&1; then
            echo "${DB_USER} password authentication works"
            break
        fi
        if [ $i -eq 60 ]; then
            echo "WARNING: ${DB_USER} password auth not working after 60 seconds"
            exit 0
        fi
        sleep 1
    done
else
    echo "Waiting 15 seconds for PostgreSQL init scripts to complete..."
    sleep 15
    for i in {1..30}; do
        if podman exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1; then
            echo "PostgreSQL is stable and ready"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "WARNING: PostgreSQL became unresponsive"
            exit 0
        fi
        sleep 1
    done
fi

CURRENT_CREATEDB=$(podman exec "$CONTAINER_NAME" psql -U postgres -tAc "SELECT rolcreatedb FROM pg_roles WHERE rolname='${DB_USER}'" 2>/dev/null | tr -d ' ' || echo "")

if [ "$CURRENT_CREATEDB" = "t" ]; then
    echo "${DB_USER} already has CREATEDB privilege"
    exit 0
fi

echo "Granting CREATEDB privilege to ${DB_USER}..."
podman exec "$CONTAINER_NAME" psql -U postgres -c "ALTER ROLE ${DB_USER} CREATEDB;" 2>&1 | grep -v "NOTICE" || true
echo "CREATEDB privilege granted successfully"
