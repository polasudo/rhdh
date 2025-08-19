#!/bin/bash

# check_repository function is for checking repository changes
#
# Usage: check_repository <quay_repo_and_tag> <sync_file> <repo_suffix>
# Returns: 0 if changes are detected, 1 if no changes or error

norm="\033[0;39m"
green="\033[1;32m"
# blue="\033[1;34m"
red="\033[1;31m"

check_repository() {
    local quay_repo_and_tag="$1"
    local sync_file="$2"
    local repo_suffix="$3"
    
    # Check if required parameters are provided
    if [[ -z "$quay_repo_and_tag" ]] || [[ -z "$sync_file" ]] || [[ -z "$repo_suffix" ]]; then
        echo "${red}[ERROR] Missing required parameters for check_repository${norm}" >&2
        echo "${red}[ERROR] Usage: check_repository <quay_repo_and_tag> <sync_file> <repo_suffix>${norm}" >&2
        echo >&2
        echo "${red}[ERROR] Example: check_repository quay.io/rhdh/rhdh-operator-bundle sync/upstream_SHA_rhdh-operator-bundle OPERATOR_BUNDLE${norm}" >&2
        return 1
    fi
    
    echo "${green}[INFO] Checking $repo_suffix repository for $quay_repo_and_tag ...${norm}"
    
    # Extract upstream SHA from the container image
    local UPSTREAM_SHA
    # when any command in the pipeline fails, the pipeline fails and set skopeo_exit_code to 1
    set -o pipefail
    UPSTREAM_SHA=$(skopeo inspect "docker://$quay_repo_and_tag" | jq -r '.Env[] | select(.|test("_REPO=")?)' | grep UPSTREAM_REPO= | sed -r -e "s/.+@ //")
    skopeo_exit_code=$?
    set +o pipefail

    # Check for command failure first
    if [[ $skopeo_exit_code -ne 0 ]]; then
        echo "${red}[ERROR] Failed to inspect container $quay_repo_and_tag (exit code: $skopeo_exit_code)${norm}" >&2
        return $skopeo_exit_code
    fi

    # Validate that we extracted a hash
    if [[ -z "$UPSTREAM_SHA" ]]; then
        echo "${red}[ERROR] Failed to extract UPSTREAM_REPO SHA from $quay_repo_and_tag${norm}" >&2
        return 1
    fi
    
    # Read current SHA from sync file
    if [[ -f "$sync_file" ]]; then
        local CURRENT_SHA_RAW
        local CURRENT_SHA
        
        CURRENT_SHA_RAW=$(cat "$sync_file")
        
        # Extract only the hash part from the beginning
        # keep only the digest at the start of the line; trim everything off after the space
        CURRENT_SHA=${CURRENT_SHA_RAW%% *}
        
        # Validate that we extracted a hash
        if [[ -z "$CURRENT_SHA" ]]; then
            echo "${red}[ERROR] Failed to extract hash from sync file content for $repo_suffix: $CURRENT_SHA_RAW${norm}" >&2
            return 1
        fi
        
        if [[ "$CURRENT_SHA" == "$UPSTREAM_SHA" ]]; then
            echo "${green}[INFO] No new changes for $repo_suffix (SHA = $UPSTREAM_SHA).${norm}"
            return 1
        else
            echo "${green}[INFO] New changes found for $repo_suffix! SHA changed from $CURRENT_SHA to $UPSTREAM_SHA${norm}"
            return 0
        fi
    else
        echo "${red}[ERROR] Sync file not found for $repo_suffix. Creating new file...${norm}"
        return 1
    fi
}

# Function to check if any Quay repository has changes
# Returns: 0 if changes detected, 1 if no changes or error
check_repositories_return=0
check_repositories() {
    local TAG
    if [[ $1 ]]; then TAG="$1"; else TAG="next"; fi
    QUAY_REPO_HUB="${QUAY_REPO_HUB:-quay.io/rhdh/rhdh-hub-rhel9:$TAG}"
    QUAY_REPO_OPERATOR="${QUAY_REPO_OPERATOR:-quay.io/rhdh/rhdh-rhel9-operator:$TAG}"
    SYNC_FILE_HUB="${SYNC_FILE_HUB:-sync/upstream_SHA_rhdh-hub}"
    SYNC_FILE_OPERATOR="${SYNC_FILE_OPERATOR:-sync/upstream_SHA_rhdh-operator}"

    check_repository "$QUAY_REPO_HUB" "$SYNC_FILE_HUB" "HUB"
    (( check_repositories_return = check_repositories_return + $? ))
    check_repository "$QUAY_REPO_OPERATOR" "$SYNC_FILE_OPERATOR" "OPERATOR"
    (( check_repositories_return = check_repositories_return + $? ))

    # return value in check_repositories_return
    return $check_repositories_return
}

# Export functions so they can be used when sourced    
export -f check_repository check_repositories
