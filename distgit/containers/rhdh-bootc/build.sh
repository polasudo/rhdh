#!/usr/bin/env bash
# Local build for the RHDH bootc base image.
# Requires a RHEL-subscribed host and registry.redhat.io credentials.
#
# Usage:
#   ./build.sh                  # uses auto-detected auth
#   ./build.sh --no-cache       # rebuild without layer cache
set -euo pipefail

cd "$(dirname "$0")"

AUTH_FILE=""

# Locate registry credentials
if [[ -f auth.json ]]; then
    AUTH_FILE="auth.json"
    echo "[INFO] Using ./auth.json"
else
    for f in \
        "${CONTAINERS_AUTHFILE:-}" \
        "${HOME}/.config/containers/auth.json" \
        "${XDG_RUNTIME_DIR:-/dev/null}/containers/auth.json" \
        "${HOME}/.docker/config.json"
    do
        [[ -n "$f" && -f "$f" ]] || continue
        cp "$f" auth.json
        AUTH_FILE="auth.json"
        echo "[INFO] Copied auth from: $f"
        break
    done
fi

if [[ -z "$AUTH_FILE" ]]; then
    echo "[ERROR] No registry credentials found."
    echo "Run:  podman login registry.redhat.io"
    echo "Then re-run ./build.sh"
    exit 1
fi

EXTRA_ARGS=""
if [[ "${1:-}" == "--no-cache" ]]; then
    EXTRA_ARGS="--no-cache"
fi

exec podman build \
    --secret "id=redhat-registry-secret,src=${AUTH_FILE}" \
    ${EXTRA_ARGS} \
    -f Containerfile \
    -t rhdh-bootc:latest \
    .
