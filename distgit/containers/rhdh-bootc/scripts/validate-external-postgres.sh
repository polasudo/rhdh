#!/bin/bash

# Validate external PostgreSQL configuration before RHDH starts.
# Skips if using local containerized PostgreSQL (rhdh-postgres).
# Checks connectivity and CREATEDB privilege when using an external database.

set -euo pipefail

ENV_FILE="/etc/rhdh/rhdh.env"
YAML_HELPER="/usr/local/lib/rhdh/yaml-helper.py"
APP_CONFIG="/etc/rhdh/configs/app-config/app-config.yaml"

# Determine the database host from env file
POSTGRES_HOST=""
if [ -f "$ENV_FILE" ]; then
    POSTGRES_HOST=$(grep "^POSTGRES_HOST=" "$ENV_FILE" | cut -d= -f2 || echo "")
fi

# Also check YAML config (production override takes precedence)
if [ -f "$YAML_HELPER" ]; then
    yaml_host=$(python3 "$YAML_HELPER" read "$APP_CONFIG" "backend.database.connection.host" 2>/dev/null) || true
    if [ -n "$yaml_host" ]; then
        POSTGRES_HOST="$yaml_host"
    fi
fi

if [ -z "$POSTGRES_HOST" ] || [ "$POSTGRES_HOST" = "rhdh-postgres" ]; then
    exit 0
fi

echo "[INFO] Validating external PostgreSQL configuration..."

POSTGRES_PORT=$(grep "^POSTGRES_PORT=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "5432")
POSTGRES_USER=$(grep "^POSTGRES_USER=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "")
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "")
POSTGRES_DB=$(grep "^POSTGRES_DB=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "")

if [ -z "${POSTGRES_HOST:-}" ]; then
    echo "[ERROR] POSTGRES_HOST not set in config"
    exit 1
fi

if [ -z "${POSTGRES_USER:-}" ]; then
    echo "[ERROR] POSTGRES_USER not set in config"
    exit 1
fi

if [ -z "${POSTGRES_PASSWORD:-}" ]; then
    echo "[ERROR] POSTGRES_PASSWORD not set in config"
    exit 1
fi

if [ -z "${POSTGRES_DB:-}" ]; then
    echo "[ERROR] POSTGRES_DB not set in config"
    exit 1
fi

echo "[OK] Configuration variables are set"
echo "   Host: ${POSTGRES_HOST}:${POSTGRES_PORT}"
echo "   Database: ${POSTGRES_DB}"
echo "   User: ${POSTGRES_USER}"

if command -v psql >/dev/null 2>&1; then
    echo "[INFO] Testing database connection..."

    if PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "${POSTGRES_PORT}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;" >/dev/null 2>&1; then
        echo "[OK] Successfully connected to external database"

        echo "[INFO] Checking CREATEDB privilege..."
        HAS_CREATEDB=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "${POSTGRES_PORT}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT rolcreatedb FROM pg_roles WHERE rolname = '$POSTGRES_USER';" 2>/dev/null | tr -d '[:space:]')

        if [ "$HAS_CREATEDB" = "t" ]; then
            echo "[OK] User '$POSTGRES_USER' has CREATEDB privilege"
        else
            echo "[WARN] User '$POSTGRES_USER' does NOT have CREATEDB privilege"
            echo "   Backstage requires CREATEDB to create plugin databases"
            echo "   Run on your PostgreSQL server: ALTER ROLE $POSTGRES_USER CREATEDB;"
        fi
    else
        echo "[WARN] Could not connect to external database"
        echo "   Please verify the connection details and ensure the database is accessible"
    fi
else
    echo "[WARN] psql not available, skipping connection test"
    echo "   Please manually verify your external database is accessible"
fi

echo "[OK] External PostgreSQL validation complete"
exit 0
