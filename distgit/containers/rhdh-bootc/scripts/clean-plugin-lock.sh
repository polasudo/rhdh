#!/bin/bash
# Clean up stale dynamic plugins lock file that can prevent RHDH startup
# This script runs as ExecStartPre to ensure clean startup
set -euo pipefail

LOCK_FILE="/var/lib/rhdh/dynamic-plugins-root/install-dynamic-plugins.lock"

if [ -f "$LOCK_FILE" ]; then
    echo "Found stale lock file at ${LOCK_FILE}, removing..."
    rm -f "$LOCK_FILE"
    echo "Lock file cleaned up"
fi
