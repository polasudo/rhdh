#!/bin/bash

# check_repository function is for checking repository changes
#
# Usage: check_repository <quay_repo> <sync_file> <repo_suffix>
# Returns: 0 if changes are detected, 1 if no changes or error

norm="\033[0;39m"
green="\033[1;32m"
blue="\033[1;34m"
red="\033[1;31m"

check_repository() {
    local quay_repo="$1"
    local sync_file="$2"
    local repo_suffix="$3"
    
    # Check if required parameters are provided
    if [[ -z "$quay_repo" ]] || [[ -z "$sync_file" ]] || [[ -z "$repo_suffix" ]]; then
        echo "${red}[ERROR] Missing required parameters for check_repository${norm}" >&2
        echo "${red}[ERROR] Usage: check_repository <quay_repo> <sync_file> <repo_suffix>${norm}" >&2
        echo >&2
        echo "${red}[ERROR] Example: check_repository quay.io/rhdh/rhdh-operator-bundle sync/upstream_SHA_rhdh-operator-bundle OPERATOR_BUNDLE${norm}" >&2
        return 1
    fi
    
    # Check if TAG is set
    if [[ -z "$TAG" ]]; then
        echo "${red}[ERROR] TAG environment variable is not set${norm}" >&2
        return 1
    fi
    
    echo "${green}[INFO] Checking $repo_suffix repository...${norm}"
    
    # Extract upstream SHA from the container image
    local UPSTREAM_SHA
    # when any command in the pipeline fails, the pipeline fails and set skopeo_exit_code to 1
    set -o pipefail
    UPSTREAM_SHA=$(skopeo inspect "docker://$quay_repo:$TAG" | jq -r '.Env[] | select(.|test("_REPO=")?)' | grep UPSTREAM_REPO= | sed -r -e "s/.+@ //")
    skopeo_exit_code=$?
    set +o pipefail

    # Check for command failure first
    if [[ $skopeo_exit_code -ne 0 ]]; then
        echo "${red}[ERROR] Failed to inspect container $quay_repo:$TAG (exit code: $skopeo_exit_code)${norm}" >&2
        return $skopeo_exit_code
    fi

    # Validate that we extracted a hash
    if [[ -z "$UPSTREAM_SHA" ]]; then
        echo "${red}[ERROR] Failed to extract UPSTREAM_REPO SHA from $quay_repo:$TAG${norm}" >&2
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
            echo "${green}[INFO] No new changes for $repo_suffix.${norm}"
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

# Export the function so it can be used when sourced
export -f check_repository
