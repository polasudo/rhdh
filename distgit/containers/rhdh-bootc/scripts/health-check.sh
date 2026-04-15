#!/bin/bash
# Health check for RHDH bootc base image services.
# Verifies PostgreSQL and RHDH are running and responding.
set -euo pipefail

EXIT_CODE=0

echo "=== RHDH Base Image Health Check ==="

if systemctl is-active --quiet postgres.service; then
    echo "  PostgreSQL service: active"
else
    echo "  PostgreSQL service: NOT active"
    EXIT_CODE=1
fi

if podman exec rhdh-postgres pg_isready -U postgres >/dev/null 2>&1; then
    echo "  PostgreSQL database: ready"
else
    echo "  PostgreSQL database: NOT ready"
    EXIT_CODE=1
fi

if systemctl is-active --quiet rhdh.service; then
    echo "  RHDH service: active"
else
    echo "  RHDH service: NOT active"
    EXIT_CODE=1
fi

if curl -sf http://localhost:7007 >/dev/null 2>&1; then
    echo "  RHDH backend: responding"
else
    echo "  RHDH backend: NOT responding"
    EXIT_CODE=1
fi

if [ "$EXIT_CODE" -eq 0 ]; then
    echo "=== Health check passed ==="
else
    echo "=== Health check FAILED ==="
fi

exit "$EXIT_CODE"
