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

# Extract SHA256 digest hex from image reference like repo@sha256:<hex>
extract_digest_hex() {
    local image_ref="$1"
    echo "$image_ref" | sed -nE 's#.*@sha256:([a-f0-9]+).*#\1#p'
}

# Read image digest from an OCI chart artifact values.yaml
get_chart_hub_digest() {
    local chart_image="$1"
    local tmpdir
    tmpdir=$(mktemp -d)

    if ! skopeo copy "docker://${chart_image}" "dir:${tmpdir}" >/dev/null 2>&1; then
        rm -rf "${tmpdir}" >/dev/null 2>&1 || true
        return 1
    fi

    local chart_layer_digest
    chart_layer_digest=$(jq -r '[.layers[] | select(.mediaType=="application/vnd.cncf.helm.chart.content.v1.tar+gzip") | .digest][0]' "${tmpdir}/manifest.json")
    if [[ -z "${chart_layer_digest}" || "${chart_layer_digest}" == "null" ]]; then
        rm -rf "${tmpdir}" >/dev/null 2>&1 || true
        return 1
    fi

    local chart_layer_blob="${tmpdir}/${chart_layer_digest#*:}"
    if [[ ! -f "${chart_layer_blob}" ]]; then
        # fallback for skopeo layouts that use algo/hash folders
        chart_layer_blob="${tmpdir}/${chart_layer_digest/:/\/}"
    fi
    local digest_hex
    digest_hex=$(python3 - "${chart_layer_blob}" <<'PY'
import re
import sys
import tarfile

blob_path = sys.argv[1]

def clean(v):
    return v.strip().strip('"').strip("'")

with tarfile.open(blob_path, "r:gz") as tf:
    values_members = [m for m in tf.getmembers() if m.name.endswith("/values.yaml") or m.name == "values.yaml"]
    if not values_members:
        sys.exit(1)
    values_members.sort(key=lambda m: len(m.name))
    content = tf.extractfile(values_members[0]).read().decode("utf-8", errors="ignore")

path = []
registry = None
repository = None
tag = None

for raw_line in content.splitlines():
    line = raw_line.split("#", 1)[0].rstrip()
    if not line.strip():
        continue
    match = re.match(r"^(\s*)([A-Za-z0-9_.-]+):\s*(.*)$", line)
    if not match:
        continue
    spaces, key, value = match.groups()
    depth = len(spaces) // 2
    path = path[:depth]
    path.append(key)
    path_str = "/".join(path)
    val = clean(value)
    if path_str == "upstream/backstage/image/registry" and val:
        registry = val
    elif path_str == "upstream/backstage/image/repository" and val:
        repository = val
    elif path_str == "upstream/backstage/image/tag" and val:
        tag = val

if not repository:
    sys.exit(2)

if "@sha256:" in repository:
    digest = repository.split("@sha256:", 1)[1]
elif repository.endswith("@sha256") and tag:
    digest = tag
else:
    # Fall back to digest in tag if present as sha256:<hex>
    digest = tag.split("sha256:", 1)[1] if tag and "sha256:" in tag else ""

digest = digest.strip()
if not re.fullmatch(r"[a-f0-9]{64}", digest):
    sys.exit(3)
print(digest)
PY
)
    local rc=$?
    rm -rf "${tmpdir}" >/dev/null 2>&1 || true
    if [[ $rc -ne 0 || -z "${digest_hex}" ]]; then
        return 1
    fi
    echo "${digest_hex}"
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

# Check chart digest and bundle digest point to same hub image
echo "[INFO] Compare Helm chart and operator bundle hub image digests"
CHART_IMAGE="$(get_latest_chart_image "${RHDH_VERSION}")"
BUNDLE_IMAGE="$(echo "${CONTAINERS}" | grep "rhdh-operator-bundle" | head -n1)"

if [[ -n "${CHART_IMAGE}" && "${CHART_IMAGE}" != *":???" && -n "${BUNDLE_IMAGE}" ]]; then
    echo "[INFO] Latest chart image in quay.io : ${CHART_IMAGE}"
    echo "[INFO] Latest operator bundle image in quay.io : ${BUNDLE_IMAGE}"

    chart_hub_digest="$(get_chart_hub_digest "${CHART_IMAGE}")"
    bundle_hub_image_ref="$("${SCRIPTPATH}/checkImagesInCSV.sh" -y --digests -qq -i "rhdh-hub-rhel9" "${BUNDLE_IMAGE}" | head -n1)"
    bundle_hub_digest="$(extract_digest_hex "${bundle_hub_image_ref}")"

    if [[ -n "${chart_hub_digest}" && -n "${bundle_hub_digest}" ]]; then
        if [[ "${chart_hub_digest}" == "${bundle_hub_digest}" ]]; then
            echo -e "${green} Chart and operator bundle use the same RHDH hub digest (${chart_hub_digest})${norm}"
        else
            echo -e "${red} MISMATCH: Chart and operator bundle reference different RHDH hub digests${norm}"
            echo -e "${red}  Chart digest : ${chart_hub_digest}${norm}"
            echo -e "${red}  Bundle digest: ${bundle_hub_digest}${norm}"
            echo -e "${blue} Trigger/rebuild bundle and chart so both resolve to the same hub container image.${norm}"
        fi
    else
        echo -e "${red} Could not resolve both hub digests for chart/bundle comparison${norm}"
        echo -e "${blue}  chart digest : ${chart_hub_digest:-<missing>}${norm}"
        echo -e "${blue}  bundle image : ${bundle_hub_image_ref:-<missing>}${norm}"
    fi
else
    echo -e "${red} Could not find latest chart or operator bundle image for ${RHDH_VERSION}${norm}"
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
