#!/bin/bash

# triggering respin and rendering catalogs

set -e

QUAY_REPO_OPERATOR_BUNDLE="${QUAY_REPO_OPERATOR_BUNDLE:-quay.io/rhdh/rhdh-operator-bundle}"
SYNC_FILE_OPERATOR_BUNDLE="${SYNC_FILE_OPERATOR_BUNDLE:-sync/upstream_SHA_rhdh-operator-bundle}"

source "$(dirname "$0")/check-repository.sh"

# Function to trigger respin and render catalogs
trigger_respin_render() {
    local VERSION="$1"
    
    echo "[INFO] Respin operator-bundle and FBCs for changes to hub or operator images"
    
    if [ ! -f "./build/scripts/triggerRespin.sh" ]; then
        echo "[ERROR] triggerRespin.sh not found"
        exit 1
    fi

    if [ ! -f "./build/scripts/renderCatalogs.sh" ]; then
        echo "[ERROR] renderCatalogs.sh not found"
        exit 1
    fi
    
    echo "[INFO] Running triggerRespin.sh to create operator bundle..."
    ./build/scripts/triggerRespin.sh -v "$VERSION" bun
    
    echo "[INFO] Polling for new operator bundle every 3 minutes..."
    # Poll every 3 minutes for up to 15 minutes (5 attempts)
    MAX_ATTEMPTS=5
    ATTEMPT=1
    NEW_BUNDLE_DETECTED=false
    
    while [[ $ATTEMPT -le $MAX_ATTEMPTS ]] && [[ "$NEW_BUNDLE_DETECTED" == "false" ]]; do
        echo "[INFO] Polling attempt $ATTEMPT/$MAX_ATTEMPTS..."
        
        # Wait 3 minutes between attempts
        if [[ $ATTEMPT -gt 1 ]]; then
            echo "[INFO] Waiting 3 minutes before next check..."
            sleep 3m
        fi
        
        # Use the existing check_repository function to detect changes
        if [[ $(check_repository "$QUAY_REPO_OPERATOR_BUNDLE" "$SYNC_FILE_OPERATOR_BUNDLE" "OPERATOR_BUNDLE") -ne 0 ]]; then
            true; # echo "[INFO] No new operator bundle detected yet (attempt $ATTEMPT)"
        else
            echo "[INFO] New operator bundle found at $QUAY_REPO_OPERATOR_BUNDLE:$VERSION"
            NEW_BUNDLE_DETECTED=true
        fi
        
        ATTEMPT=$((ATTEMPT + 1))
    done
    
    # Check final result
    if [[ "$NEW_BUNDLE_DETECTED" == "true" ]]; then
        echo "[INFO] New operator bundle detected! Running renderCatalogs.sh..."
        ./build/scripts/renderCatalogs.sh --default-sealights
        echo "[INFO] Respin and render catalogs triggered successfully"
    else
        echo "[INFO] No new operator bundle detected - no new FBCs to render."
    fi
}

# Export the function
export -f trigger_respin_render

# If script is run directly, execute the function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -lt 1 ]]; then
        echo "Usage: $0 <VERSION>"
        echo "Example: $0 1.8"
        exit 1
    fi
    
    trigger_respin_render "$1"
fi
