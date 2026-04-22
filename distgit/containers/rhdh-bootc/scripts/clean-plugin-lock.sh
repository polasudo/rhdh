#!/bin/bash
# Clean up stale dynamic plugins lock file that can prevent RHDH startup
# This script runs as ExecStartPre to ensure clean startup
set -euo pipefail

LOCK_FILE="/opt/app-root/src/dynamic-plugins-root/install-dynamic-plugins.lock"

if podman ps -a --format '{{.Names}}' 2>/dev/null | grep -q '^rhdh$'; then
    if podman exec rhdh test -f "$LOCK_FILE" 2>/dev/null; then
        echo "Found stale lock file in rhdh container, removing it..."
        podman exec rhdh rm -f "$LOCK_FILE" || true
        echo "Lock file cleaned up"
    fi
else
    echo "No existing rhdh container, lock cleanup not needed"
fi
