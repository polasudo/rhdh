#!/bin/bash
#
# Copyright (c) Red Hat, Inc.
#
# update operator-bundle and re-render FBC catalogs

set -e

QUAY_REPO_OPERATOR_BUNDLE="${QUAY_REPO_OPERATOR_BUNDLE:-quay.io/rhdh/rhdh-operator-bundle}"
SYNC_FILE_OPERATOR_BUNDLE="${SYNC_FILE_OPERATOR_BUNDLE:-sync/upstream_SHA_rhdh-operator-bundle}"

ROOTPATH=$(dirname "$0"); ROOTPATH=${ROOTPATH/\/build\/ci}
# shellcheck disable=SC1091
source "$ROOTPATH/build/ci/check-repository.sh"

# Function to trigger respin and render catalogs
update_bundle_and_FBCs() {
    local VERSION="$1"
    
    echo "[INFO] Update operator-bundle and FBCs for changes to hub or operator images"
    
    if [ ! -f "$ROOTPATH/build/scripts/triggerRespin.sh" ]; then
        echo "[ERROR] triggerRespin.sh not found"
        exit 1
    fi

    if [ ! -f "$ROOTPATH/build/scripts/renderCatalogs.sh" ]; then
        echo "[ERROR] renderCatalogs.sh not found"
        exit 1
    fi
    
    echo "[INFO] Run triggerRespin.sh to update operator-bundle..."
    "$ROOTPATH/build/scripts/triggerRespin.sh" -v "$VERSION" bun
    
    echo "[INFO] Polling for new operator-bundle every 3 minutes..."
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
            true; # echo "[INFO] No new operator-bundle detected yet (attempt $ATTEMPT)"
        else
            echo "[INFO] New operator-bundle found at $QUAY_REPO_OPERATOR_BUNDLE:$VERSION"
            NEW_BUNDLE_DETECTED=true
        fi
        
        ATTEMPT=$((ATTEMPT + 1))
    done
    
    # Check final result
    if [[ "$NEW_BUNDLE_DETECTED" == "true" ]]; then
        echo "[INFO] New operator-bundle detected! Running renderCatalogs.sh..."
        # TODO remove this if-block once 1.6 is EOL and we're always using sealights
        if [[ $VERSION == "1.6"* ]]; then 
            OCP_VERSION=4.14
            pushd "$ROOTPATH" >/dev/null 2>&1 || exit 1
                ./build/scripts/renderCatalogs.sh  --clean --versions "${OCP_VERSION}" -v "${RHDH_VERSION}"; sleep 30s; echo
                for OCP_VERSION in 4.15 4.16 4.17 4.18 4.19 4.20; do \
                cp -f catalogs/v{4.14,${OCP_VERSION}}/catalog-template.json; \
                ./build/scripts/renderCatalogs.sh  --clean --versions "${OCP_VERSION}" -v "${RHDH_VERSION}" --template "catalogs/v${OCP_VERSION}/catalog-template.json"; sleep 30s; \
                done
            popd >/dev/null 2>&1 || exit 1
        else
            # for 1.7+
            "$ROOTPATH/build/scripts/renderCatalogs.sh" --default-sealights
        fi
        echo "[INFO] FBC catalogs updated successfully"
    else
        echo "[INFO] No new operator-bundle detected - no new FBCs to render."
    fi
}

# Export the function
export -f update_bundle_and_FBCs

# If script is run directly, execute the function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -lt 1 ]]; then
        echo "Usage: $0 <VERSION>"
        echo "Example: $0 1.8"
        exit 1
    fi
    
    update_bundle_and_FBCs "$1"
fi
