#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
# SPDX-License-Identifier: EPL-2.0
#
# Script to perform weekly maintenance tasks:
# 1. Update base images in active branches
# 2. Cleanup old tags from Quay

set -e

# Ensure we have a project root (useful when running locally)
if [[ -z "${CI_PROJECT_DIR:-}" ]]; then
    CI_PROJECT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
fi

command -v jq >/dev/null 2>&1 || { echo "jq is not installed. Aborting."; exit 1; }
command -v skopeo >/dev/null 2>&1 || { echo "skopeo is not installed. Aborting."; exit 1; }

# Use the scripts from the current default branch rhdh-1-rhel-9
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(cd "$(dirname "$0")/../scripts" && pwd)
ROOTPATH=$(dirname "$SCRIPT"); ROOTPATH=${ROOTPATH/\/build\/ci}

# logins (quay.io, registry.redhat.io) are loaded here 
if [[ $CI_BUILDS_DIR ]]; then # running in gitlab so set up env
  echo -e "[INFO] Running in gitlab pipeline."
  # shellcheck disable=SC1091
  source "${ROOTPATH}/build/ci/gitlab-ci-env-setup.sh"
fi

echo "--- Starting Update Base Images ---"

git fetch origin

# list upstream remote branches, filter for latest 2, sort version descending, eg., main release-1.8 release-1.7
TARGET_BRANCHES="main $(git branch -r | grep -E "release-[0-9.]+" | sort -V -r | head -n 2 | sed -r -e "s|.+origin/||" | tr '\n' ' ')"

# List of branches we want to process
echo "Target versions for update: $TARGET_BRANCHES"

# Upstream repositories to update
# We need to clone these and run the update script inside them
declare -A UPSTREAM_REPOS
UPSTREAM_REPOS=( 
    ["rhdh-hub"]="https://github.com/redhat-developer/rhdh"
    ["rhdh-operator"]="https://github.com/redhat-developer/rhdh-operator"
)

UPDATE_SCRIPT="$SCRIPT_DIR/updateBaseImages.sh"
if [[ ! -f "$UPDATE_SCRIPT" ]]; then
    echo "Error: updateBaseImages.sh not found at $UPDATE_SCRIPT"
    exit 1
fi

# Create temp dir for upstream clones
UPSTREAM_WORK_DIR=$(mktemp -d)

for repo_name in "${!UPSTREAM_REPOS[@]}"; do
    repo_url="${UPSTREAM_REPOS[$repo_name]}"
    echo "=================================================="
    echo "Processing upstream repo: $repo_name ($repo_url)"
    
    # Clone repo
    repo_dir="$UPSTREAM_WORK_DIR/$repo_name"
    git clone "$repo_url" "$repo_dir" || { echo "Failed to clone $repo_url"; continue; }
    
    for upstream_branch in $TARGET_BRANCHES; do
        echo "  Checking $upstream_branch"
        
        pushd "$repo_dir" >/dev/null || continue

        # identify git user
        git config user.email "rhdh-bot@redhat.com"
        git config user.name "RHDH Build (rhdh-bot)"
        # insert user and token into the remote git URL
        git remote set-url origin "${repo_url/https:\/\//http:\/\/rhdh-bot:${GITHUB_TOKEN}@}"

        # Verify if upstream branch exists
        if ! git show-ref --verify --quiet "refs/remotes/origin/$upstream_branch"; then
            echo "  Branch $upstream_branch does not exist in $repo_name. Skipping."
            popd >/dev/null || true
            continue
        fi
        
        echo "  Updating base images for $repo_name on branch $upstream_branch"
        
        # Checkout branch
        git checkout "$upstream_branch" || { echo "  Failed to checkout $upstream_branch"; popd >/dev/null || true; continue; }
        
        # Run update script
        # -w $(pwd): workspace is current upstream repo dir
        # -b $upstream_branch: target branch
        "$UPDATE_SCRIPT" -w "$(pwd)" -b "$upstream_branch" --pr || echo "  Failed update for $repo_name:$upstream_branch"
        
        # Return to previous directory
        popd >/dev/null || true
    done
done

# Clean up upstream clones
rm -rf "$UPSTREAM_WORK_DIR"

echo "--- Starting Quay Tag Cleanup ---"

# If in gitlab and token not defined in this bash shell, fetch it from secure files then delete it
if [[ -z "$QUAY_APP_ACCESS_TOKEN" ]]; then
    if [[ $CI_PROJECT_DIR ]]; then
        echo "Error: QUAY_APP_ACCESS_TOKEN is not set. Check if gitlab-ci-env-setup.sh ran correctly. Must exit!"
    else 
        echo "Error: QUAY_APP_ACCESS_TOKEN is not set. Must exit!"
    fi
    exit 1
fi

DELETE_SCRIPT="$SCRIPT_DIR/deleteTagsFromQuay.sh"

# Attempt to find version from package.json (hub) to match other scripts
VERSION_FILE_JSON="distgit/containers/rhdh-hub/package.json"
VERSION_FILE_FALLBACK="distgit/containers/rhdh-operator/config/profile/rhdh/kustomization.yaml"
if [[ -f "$VERSION_FILE_JSON" ]]; then
    CURRENT_VER=$(jq -r '.version' "$VERSION_FILE_JSON" 2>/dev/null)
    # Convert 1.9.0 -> 1.9 to align with tag naming
    CURRENT_VER="${CURRENT_VER%.*}"
elif [[ -f "$VERSION_FILE_FALLBACK" ]]; then
    CURRENT_VER=$(grep "newTag:" "$VERSION_FILE_FALLBACK" | awk -F'"' '{print $2}' | head -n 1)
else
    echo "Error: Unable to determine RHDH version (missing package.json and kustomization.yaml)."
    exit 1
fi

if [[ -z "$CURRENT_VER" ]]; then
    echo "Error: RHDH version is empty. Aborting."
    exit 1
fi

echo "Detected current version: $CURRENT_VER"

# Compute Old Y (Current Minor - 4)
# Assumes version format 1.Y or 1.Y.Z
CURRENT_MINOR=$(echo "$CURRENT_VER" | cut -d. -f2)
OLD_MINOR=$((CURRENT_MINOR - 4))

if [[ $OLD_MINOR -lt 0 ]]; then
    OLD_MINOR=0
fi

OLD_Y="1.${OLD_MINOR}"
echo "Old version threshold calculated: $OLD_Y"

# ensure we don't accidentally plaintext the token in the console!
set +x

# delete Konflux tags which are also re-tagged with more meaningful tags
echo "Deleting 'on-' tags older than 10 days..."
"$DELETE_SCRIPT" --filter "on-" --age "10 days" --token "$QUAY_APP_ACCESS_TOKEN" $DELETE_ARGS

# delete 1.y- tags from EOL releases 
echo "Deleting '$OLD_Y-' tags older than 4 months..."
"$DELETE_SCRIPT" --filter "${OLD_Y}-" --age "4 months" --token "$QUAY_APP_ACCESS_TOKEN" $DELETE_ARGS

# this includes .att and .sbom so keep these longer
echo "Deleting 'sha256-' tags older than 8 months..."
"$DELETE_SCRIPT" --filter "sha256-" --age "8 months" --token "$QUAY_APP_ACCESS_TOKEN" $DELETE_ARGS

echo "Maintenance completed."

