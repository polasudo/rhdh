#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#

# for a given RHDH 1.y version, find the latest images' sources and commit SHAs
#  and compare them to the latest commits on the upstream repos
DEFAULT_OCP_VERSION="4.18"

usage() {
    echo "Usage:

Specify a RHDH version to fetch the latest images from quay and compare the commit SHAs to the latest commits on the upstream repos.

    $0 -v RHDH_VERSION [-o OCP_VERSION]

Options:
    -o OCP_VERSION     OCP version (e.g. 4.18)
    
Examples: 
    $0 -v 1.7
    $0 -v 1.7 -o 4.18
"
}

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-v') RHDH_VERSION="$2"; shift 2;; 
    '-o') OCP_VERSION="$2"; shift 2;;
    '-h'|'--help') usage; exit 0;;
    *) echo "Unknown parameter used: $1."; usage; exit 1;;
  esac
done

if [[ ! $RHDH_VERSION ]]; then usage; exit; fi
if [[ ! $OCP_VERSION ]]; then OCP_VERSION="${DEFAULT_OCP_VERSION}"; fi

SCRIPT=$(readlink -f "$0"); SCRIPTPATH=$(dirname "$SCRIPT")

norm="\033[0;39m"
green="\033[1;32m"
blue="\033[1;34m"
red="\033[1;31m"

# Function to get the latest commit SHA from GitHub repository and branch
get_latest_github_commit() {
    local upstream_repo_line="$1"
    
    # Extract repository URL and branch from the line
    # Format: UPSTREAM_REPO=https://github.com/redhat-developer/rhdh/tree/release-1.7 @ 2ccfbb76
    local repo_url
    repo_url=$(echo "$upstream_repo_line" | sed -r -e 's/UPSTREAM_REPO=([^@]+).*/\1/' | sed 's/[[:space:]]*$//')
    
    # Remove the base URL and extract the path part
    local path_part="${repo_url#https://github.com/}"
    
    local owner_repo="${path_part%%/tree/*}"
    # Extract the branch from the path part
    local branch="${path_part#*/tree/}"
    
    # Get the latest commit SHA from GitHub API
    local api_url="https://api.github.com/repos/$owner_repo/commits/$branch"

    local curl_output
    curl_output=$(curl -s "$api_url" 2>&1)

    local latest_sha
    latest_sha=$(echo "$curl_output" | jq -r '.sha' 2>/dev/null)
    
    # Check if we got a valid SHA
    if [[ -z "$latest_sha" || "$latest_sha" == "null" ]]; then
        echo -e "${red}[ERROR] Failed to get latest commit SHA from GitHub API${norm}" >&2
        return 1
    fi
    
    # Return the latest_sha so it can be captured by calling code
    echo "$latest_sha"
}

# Get images from getLatestImageTags.sh
echo "[INFO] Get latest GA containers from registry.redhat.io/rhdh: getLatestImageTags.sh --rhec --latestNext ${RHDH_VERSION}"
CONTAINERS="$("${SCRIPTPATH}/getLatestImageTags.sh" -b "rhdh-${RHDH_VERSION}-rhel-9" --rhec --latestNext "${RHDH_VERSION}")"
echo "[INFO] Containers found:"
echo "$CONTAINERS"
echo "============"

echo "[INFO] Get latest RC or CI containers from quay.io/rhdh: getLatestImageTags.sh -b rhdh-${RHDH_VERSION}-rhel-9 --quay --tag ${RHDH_VERSION}-"
CONTAINERS="$("${SCRIPTPATH}/getLatestImageTags.sh" -b "rhdh-${RHDH_VERSION}-rhel-9" --quay --tag "${RHDH_VERSION}-")"
echo "[INFO] Containers found:"
echo "$CONTAINERS"
echo "============"

# Get images from IIB using OCP_VERSION (defaults to 4.18)
echo "[INFO] Get operator bundle from IIB: checkImagesInIIB.sh -y -q quay.io/rhdh/iib:${RHDH_VERSION}-v${OCP_VERSION}-x86_64 --bundlefilter v${RHDH_VERSION} -qq"
IIB_IMAGES="$("${SCRIPTPATH}/checkImagesInIIB.sh" -y -q "quay.io/rhdh/iib:${RHDH_VERSION}-v${OCP_VERSION}-x86_64" --bundlefilter "v${RHDH_VERSION}" -qq)"
# echo "[INFO] IIB Images found:"
echo "$IIB_IMAGES"
echo "============"

# Check if IIB_IMAGES is empty and exit if so
if [[ -z "$IIB_IMAGES" ]]; then
    echo -e "${red}[ERROR] No images found in IIB. Please check the IIB image and bundle filter.${norm}"
    echo -e "${red}[ERROR] IIB Image: quay.io/rhdh/iib:${RHDH_VERSION}-v${OCP_VERSION}-x86_64${norm}"
    echo -e "${red}[ERROR] Bundle Filter: v${RHDH_VERSION}${norm}"
    exit 1
fi

# Function to check if an image with the same tag exists in IIB images
check_image_in_iib() {
    local image="$1"
    local iib_images="$2"

    echo "[INFO] The latest image in quay.io : $image"
    
    # Check if this image exists in IIB images
    echo "$iib_images" | grep -q "^$image$" && return 0 || return 1
}

echo

# Variable to store the result of rhdh-rhel9-operator check
operator_check_result=""

for q in $CONTAINERS; do 
    upstream_repo_line=$(skopeo inspect "docker://$q" | jq -r '.Env[] | select(.|test("_REPO=")?)' | grep UPSTREAM_REPO=)
    # echo "[DEBUG] $upstream_repo_line"
    
    # Special handling for rhdh-rhel9-operator-bundle - reuse operator check result
    if [[ "$q" == *"rhdh-operator-bundle"* ]]; then
        echo "[INFO] The latest rhdh-operator-bundle image in quay.io : $q"
        
        if [[ "$operator_check_result" == "true" ]]; then
            echo -e "${green} The same latest image is used for IIB (reusing operator check result)${norm}"
        elif [[ "$operator_check_result" == "false" ]]; then
            echo -e "${red} The latest image is NOT used for IIB (reusing operator check result)${norm}"
        else
            echo -e "${red} Cannot check: Operator check result not available${norm}"
        fi
    else
        if check_image_in_iib "$q" "$IIB_IMAGES"; then
            echo -e "${green} The same latest image is used for IIB${norm}"
            # Store result for potential reuse by operator-bundle
            if [[ "$q" == *"rhdh-rhel9-operator"* ]]; then
                operator_check_result="true"
            fi
        else
            echo -e "${red} The latest image is NOT used for IIB${norm}"
            # Store result for potential reuse by operator-bundle
            if [[ "$q" == *"rhdh-rhel9-operator"* ]]; then
                operator_check_result="false"
            fi
        fi
    fi
    
    # obtain the image SHA from the upstream repo line
    image_sha="$(echo "$upstream_repo_line" | sed -r -e 's/.*@ ([a-f0-9]+).*/\1/')"
    
    # Get the latest commit SHA from GitHub
    latest_github_sha=$(get_latest_github_commit "$upstream_repo_line")
    
    # Compare image SHA with latest GitHub SHA (using short SHA)
    if [[ -n "$latest_github_sha" && -n "$image_sha" ]]; then
        # Extract short GitHub SHA (first 8 characters)
        short_github_sha="${latest_github_sha:0:8}"
        
        # Extract GitHub repo URL from upstream_repo_line
        github_repo_url=$(echo "$upstream_repo_line" | sed -r -e 's/UPSTREAM_REPO=([^@]+).*/\1/' | sed 's/[[:space:]]*$//')
        github_commit_url="${github_repo_url/tree/commits}"

        if [[ "$image_sha" == "$short_github_sha" ]]; then
            echo -e "${green} Image is up to date: Image SHA ($image_sha) == The latest commit in GitHub ($short_github_sha)${norm}"
        else
            echo -e "${red} Image is OUTDATED. You need to rebuild the image: Image SHA ($image_sha) != The latest commit in GitHub ($short_github_sha)${norm}"
            echo -e "${blue} to rebuild the hub and operator images, run this command: ./build/scripts/triggerRespin.sh -v ${RHDH_VERSION} all${norm}"
            echo -e "${blue} then rebuild the operator-bundle by running this command: ./build/scripts/triggerRespin.sh -v ${RHDH_VERSION} bun${norm}"
        fi
        echo -e "${blue} View commit history: $github_commit_url${norm}";echo
        
    else
        echo -e "${red} Cannot compare: Missing SHA data${norm}";echo
    fi
done
