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

IS_NEXT=0 # generally we want to look at a 1.y version, not 1.next

DWNSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")
if [[ ${DWNSTM_BRANCH} != "rhdh-"*"-rhel-"* ]]; then DWNSTM_BRANCH="rhdh-1-rhel-9"; fi

usage() {
    echo "Usage:

Specify a RHDH version to fetch the latest images from quay and compare the commit SHAs to the latest commits on the upstream repos.

    $0 -v RHDH_VERSION [-o OCP_VERSION]

Options:
    -o OCP_VERSION     OCP version (e.g. 4.18)
    
Examples: 
    $0 -v 1.7
    $0 -v 1.7 -o 4.18
    $0 -v 1.next
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

# Resolve the hub image tag from a bundle's pinned digest using getTagForSHA.sh.
# Given a bundle image, extract its RELATED_IMAGE for rhdh-hub-rhel9 (a digest),
# then convert that digest to a human-readable tag like "1.9-200".
get_bundle_hub_tag() {
    local bundle_image="$1"
    local hub_digest_ref
    hub_digest_ref="$("${SCRIPTPATH}/checkImagesInCSV.sh" -y --digests -qq -i "rhdh-hub-rhel9" "${bundle_image}" | head -n1)"
    if [[ -z "${hub_digest_ref}" ]]; then
        return 1
    fi
    local hub_tag
    hub_tag="$("${SCRIPTPATH}/getTagForSHA.sh" -q -y "${hub_digest_ref}")"
    if [[ -z "${hub_tag}" || "${hub_tag}" == "Not found" ]]; then
        return 1
    fi
    echo "${hub_tag}"
}

# Resolve latest chart image for a given RHDH stream (e.g. 1.9-*)
get_latest_chart_image() {
    local rhdh_stream="$1"
    local chart_repo="quay.io/rhdh/chart"
    local chart_tag
    chart_tag=$(skopeo list-tags "docker://${chart_repo}" 2>/dev/null | \
        jq -r '.Tags[]?' | \
        grep -E "^${rhdh_stream}-" | \
        grep -Ev 'latest|next|candidate|guest|containers|-source|-pr-|-tmp-|-ci-|-gh-|sha256-|on-push|on-pull|build-container|build-image-index' | \
        sort -uV | \
        tail -1)
    if [[ -n "${chart_tag}" ]]; then
        echo "${chart_repo}:${chart_tag}"
    fi
}

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

if [[ $RHDH_VERSION == "1.next" ]]; then
    IS_NEXT=1
fi

if [[ $RHDH_VERSION == "1.next" ]]; then
    DWNSTM_BRANCH="rhdh-1-rhel-9"
    RHDH_VERSION=$(curl -sSLo- https://raw.githubusercontent.com/redhat-developer/rhdh/refs/heads/main/package.json | jq -r '.version') # 1.9.0
    RHDH_VERSION=${RHDH_VERSION%.*} # 1.9
else
    DWNSTM_BRANCH="rhdh-${RHDH_VERSION}-rhel-9"
fi

# no GA releases from the 1.next branch
if [[ $IS_NEXT -eq 0 ]]; then
    # Get images from getLatestImageTags.sh
    echo "[INFO] Get latest GA containers from registry.redhat.io/rhdh: getLatestImageTags.sh --rhec --latestNext ${RHDH_VERSION}"
    CONTAINERS="$("${SCRIPTPATH}/getLatestImageTags.sh" -b "${DWNSTM_BRANCH}" --rhec --latestNext "${RHDH_VERSION}")"
    echo "[INFO] Containers found:"
    echo "$CONTAINERS"
    echo "============"
fi

echo "[INFO] Get latest RC or CI containers from quay.io/rhdh: getLatestImageTags.sh --quay --tag ${RHDH_VERSION}-"
CONTAINERS="$("${SCRIPTPATH}/getLatestImageTags.sh" -b "${DWNSTM_BRANCH}" --quay --tag "${RHDH_VERSION}-")"
echo "[INFO] Containers found:"
echo "$CONTAINERS"
echo "============"

# Get images from IIB using OCP_VERSION (defaults to 4.18)
echo "[INFO] Get operator bundle from IIB: checkImagesInIIB.sh -y -q quay.io/rhdh/iib:${RHDH_VERSION}-v${OCP_VERSION}-x86_64 --bundlefilter v${RHDH_VERSION} -qq"
IIB_IMAGES="$("${SCRIPTPATH}/checkImagesInIIB.sh" -y -q "quay.io/rhdh/iib:${RHDH_VERSION}-v${OCP_VERSION}-x86_64" --bundlefilter "v${RHDH_VERSION}" -qq)"
# echo "[INFO] IIB Images found:"
echo "$IIB_IMAGES"
echo "============"

# Compare chart and bundle by resolving the hub image tag each references.
# The chart image tag (e.g. 1.9-200) is directly visible from the chart repo.
# The bundle pins a hub digest; we convert it to a tag via getTagForSHA.sh
# and compare the two tags to verify they point to the same build.
echo "[INFO] Compare Helm chart and operator bundle hub image tags"
CHART_IMAGE="$(get_latest_chart_image "${RHDH_VERSION}")"
BUNDLE_IMAGE="$(echo "${CONTAINERS}" | grep "rhdh-operator-bundle" | head -n1)"

if [[ -n "${CHART_IMAGE}" && "${CHART_IMAGE}" != *":???" && -n "${BUNDLE_IMAGE}" ]]; then
    echo "[INFO] Latest chart image in quay.io : ${CHART_IMAGE}"
    echo "[INFO] Latest operator bundle image in quay.io : ${BUNDLE_IMAGE}"

    # The chart tag encodes the hub build number (e.g. chart tag "1.9-200" → hub tag "1.9-200")
    chart_hub_tag="${CHART_IMAGE##*:}"
    chart_hub_tag="${chart_hub_tag%-CI}"
    bundle_hub_tag="$(get_bundle_hub_tag "${BUNDLE_IMAGE}")"
    # Strip repository prefix if getTagForSHA returned "repo:tag" format
    bundle_hub_tag="${bundle_hub_tag##*:}"

    if [[ -n "${chart_hub_tag}" && -n "${bundle_hub_tag}" ]]; then
        if [[ "${chart_hub_tag}" == "${bundle_hub_tag}" ]]; then
            echo -e "${green} Chart and operator bundle reference the same hub image tag (${chart_hub_tag})${norm}"
        else
            echo -e "${red} MISMATCH: Chart and operator bundle reference different hub image tags${norm}"
            echo -e "${red}  Chart hub tag : ${chart_hub_tag}${norm}"
            echo -e "${red}  Bundle hub tag: ${bundle_hub_tag}${norm}"
            echo -e "${blue} Trigger/rebuild bundle and chart so both resolve to the same hub container image.${norm}"
            exit 1
        fi
    else
        echo -e "${red} Could not resolve hub image tags for chart/bundle comparison${norm}"
        echo -e "${blue}  chart hub tag : ${chart_hub_tag:-<missing>}${norm}"
        echo -e "${blue}  bundle hub tag: ${bundle_hub_tag:-<missing>}${norm}"
        exit 1
    fi
else
    echo -e "${red} Could not find latest chart or operator bundle image for ${RHDH_VERSION}${norm}"
    exit 1
fi
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
            echo -e "${red} The latest image is NOT used for IIB: trigger a new bundle build from https://gitlab.cee.redhat.com/rhidp/rhdh/-/pipeline_schedules${norm}"
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
            echo -e "${red} You need to rebuild the image as image's commit SHA ($image_sha) != latest commit in GitHub ($short_github_sha)${norm}"
            if [[ "$q" == *"rhdh-rhel9-operator"* ]]; then
                echo -e "${blue} To rebuild the operator image, run: ./build/scripts/triggerRespin.sh -v ${RHDH_VERSION} op${norm}"
            elif [[ "$q" == *"rhdh-hub-rhel9"* ]]; then
                echo -e "${blue} To rebuild the hub image, run: ./build/scripts/triggerRespin.sh -v ${RHDH_VERSION} hub${norm}"
            fi
            echo -e "${blue} Or to rebuild the bundle and FBCs, trigger a new bundle build from https://gitlab.cee.redhat.com/rhidp/rhdh/-/pipeline_schedules${norm}"
        fi
        echo -e "${blue} View commit history: $github_commit_url${norm}";echo
        
    else
        echo -e "${red} Cannot compare: Missing SHA data${norm}";echo
    fi
done
