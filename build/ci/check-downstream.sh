#!/bin/bash

set -e

# Configuration for both repositories
QUAY_REPO_HUB="${QUAY_REPO_HUB:-quay.io/rhdh/rhdh-hub-rhel9}"
QUAY_REPO_OPERATOR="${QUAY_REPO_OPERATOR:-quay.io/rhdh/rhdh-rhel9-operator}"
SYNC_FILE_HUB="${SYNC_FILE_HUB:-sync/upstream_SHA_rhdh-hub}"
SYNC_FILE_OPERATOR="${SYNC_FILE_OPERATOR:-sync/upstream_SHA_rhdh-operator}"
UPSTREAM_REPO_HUB="${UPSTREAM_REPO_HUB:-https://github.com/redhat-developer/rhdh}"
UPSTREAM_REPO_OPERATOR="${UPSTREAM_REPO_OPERATOR:-https://github.com/redhat-developer/rhdh-operator}"

# default TAG and VERSION
TAG="next"
VERSION="1"

norm="\033[0;39m"
green="\033[1;32m"
blue="\033[1;34m"
red="\033[1;31m"

# Check for version patterns using if statements
if [[ "$CI_COMMIT_REF_NAME" =~ ^rhdh-([0-9]+\.[0-9]+)-rhel-9$ ]]; then
    # Handle version like rhdh-y.y-rhel-9
    VERSION=$(echo "$CI_COMMIT_REF_NAME" | sed 's/^rhdh-\([0-9]\+\.[0-9]\+\)-rhel-9$/\1/')
    TAG="$VERSION"
fi

echo "${green}[INFO] Image TAG: $TAG, VERSION: $VERSION for branch: $CI_COMMIT_REF_NAME${norm}"

source "$(dirname "$0")/check_repository.sh"

# Remove existing sync_report.env file to start fresh
if [ -f "sync_report.env" ]; then
    # echo "${blue}[DEBUG] Removing existing sync_report.env file${norm}"
    rm sync_report.env
fi

RESPIN_NEEDED=false
if [[ $(check_repository "$QUAY_REPO_HUB" "$SYNC_FILE_HUB" "HUB") -eq 0 ]] || \
   [[ $(check_repository "$QUAY_REPO_OPERATOR" "$SYNC_FILE_OPERATOR" "OPERATOR") -eq 0 ]]; then
    RESPIN_NEEDED=true
fi

echo "TRIGGER_RESPIN=$RESPIN_NEEDED" >> sync_report.env

# Add VERSION and TAG to sync_report.env
echo "VERSION=$VERSION" >> sync_report.env
echo "TAG=$TAG" >> sync_report.env

# Always exit with success (0) - the script completed successfully
echo "${green}[INFO]check-downstream.sh completed successfully${norm}"
exit 0
