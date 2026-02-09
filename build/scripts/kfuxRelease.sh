#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# use this script to facilitate finding a snapshot to release a set of containers or FBCs.
# for OCI artifact releases, see https://gitlab.cee.redhat.com/rhidp/rhdh-plugin-catalog/-/blob/rhdh-1-rhel-9/build/scripts/

SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)

DEBUG=0 # quieter
AUTORELEASE=0 # for FBCs only, automatically release once yaml is generated; for container releases, must apply yaml manually (so you can verify the CVE list is correct!)
FORCE=0 # normally, don't do a release if images already exist on reg.rh.io -- they should ONLY be on quay.io. This will create a second RHSA advisory for the same images, so talk to @rogue before using this option

RHDH_FULL_VERSION_INPUT="1.7.0"

CONTAINER=""
DEST=""
# ARCHES="x86_64"  # TODO add arch64/arm64

# Load OCP version configuration from ocp-versions.yaml
CONFIG_FILE="$SCRIPT_DIR/ocp-versions.yaml"
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "OCP versions file not found: $CONFIG_FILE"
    exit 1
fi

# Check for required tools early
checkPrerequisites() {
    if ! command -v yq >/dev/null 2>&1; then
        echo -e "${red}[ERROR] yq is required but not found. Please install yq (jq wrapper, NOT the mikefarah version)${norm}"
        exit 1
    fi
    echo -e "${green}[INFO] Prerequisites check passed${norm}"
}

checkPrerequisites

OCP_VERSION_BASE=$(yq -r '.OCP_VERSION_BASE' "$CONFIG_FILE")
OCP_VERSIONS=$(yq -r '.SUPPORTED_VERSIONS[]' "$CONFIG_FILE" | tr '\n' ' ')
# Add base version to the list
OCP_VERSIONS="$OCP_VERSION_BASE $OCP_VERSIONS"
BUNDLE_TAG_OR_SHA=""
SNAPSHOT_OVERRIDE=""
SNAPSHOT_STATE="completed" # override to "queued" to find other snapshots?
midstreamCommitSHA=""
CVEListFile="" # full path to a .csv file containing CVE ids and container references
advisoryType=""
ISSUES=""
BZ=""
CVE_INCLUDE_ALL=0 # by default only include some issues; use --cve-all to include all when generating release.yaml
SKIP_RPA_CHECK=0 # by default, validate RPA version configuration matches planned GA version
TEST_RPA_ONLY=0 # by default, run full release process; set to 1 to only test RPA validation

norm="\033[0;39m"
green="\033[1;32m"
blue="\033[1;34m"
red="\033[1;31m"

usage () {
    echo "\
Utility script to release one container build snapshot (4+ images) + a set of FBCs with Konflux

Requires: oc >=4.16, jq >= 1.7, yq (jq wrapper, NOT the mikefarah version)

Requires that you are already logged into the Konflux cluster via commandline, for example
   oc login --token=sha256~YOUR_TOKEN_HERE --server=https://api.stone-prod-p02.hjvn.p1.openshiftapps.com:6443

To generate a token go to https://console-openshift-console.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/k8s/cluster/projects/rhdh-tenant 
Then click on your username and select 'Copy login command' then 'Display token'"
}

usageContainers () {
  RHDH_VERSION_INPUT=${RHDH_FULL_VERSION_INPUT%.*}
  RHDH_VERSION_INPUT=${RHDH_VERSION_INPUT/./-}
  echo "\

=======================
Usage - for container snapshots:
=======================

1. oc login ...

2. Export a csv file
   from https://docs.google.com/spreadsheets/d/1JZVTc03wirx-bTpjn3muWed8cGyFTRTNe6x3Gr02hys/edit?gid=1689785403#gid=1689785403 
   for the sheet matching this release
   using File > Download > Comma Separated Values (.csv)

3. Pass that .csv file to this script:

$0 --stage -c rhdh-operator-bundle -v $RHDH_FULL_VERSION_INPUT --cve /tmp/RHDH\ CVE\ Management\ -\ $RHDH_FULL_VERSION_INPUT.csv --debug 
$0 --prod  -c rhdh-operator-bundle:1.5-202 -v 1.5.2 --cve /tmp/RHDH\ CVE\ Management\ -\ 1.5.2.csv 
$0 --prod  -c rhdh-operator-bundle:1.6-??? -v 1.6.2 --cve /tmp/RHDH\ CVE\ Management\ -\ 1.6.2.csv [--cve-all] \
  [--issues RHIDP-7725,RHIDP-7726,...]

# Test RPA validation only
$0 --test-rpa-check -v $RHDH_FULL_VERSION_INPUT

Options:
  --cve              Full path to the CVE list file to use for the container Release, eg., /tmp/RHDH\ CVE\ Management\ -\ 1.y.z.csv
  --cve-all          Include all CVEs, regardless of status; default: only include CVEs in the release.yaml if Resolution = ReleasePending
  --issues           Space or comma separated list of issue(s) to include in this RHBA (or RHSA). Issues listed will be automatically closed 
                     when the container images are live in RHEC.
  --bz               Space or comma separated list of bugzilla(s) to include in this RHBA. Useful for linking to upstream base image issues 
                     fixed in a .z respin. See RHIDP-8185 for how to get the list of BZs for a CVE.
  --skip-rpa-check   Skip validation of RPA (Release Plan Admission) version configuration. NOT RECOMMENDED as this can result
                     in containers being tagged with incorrect versions if the RPA config is outdated.
  --test-rpa-check   Test the RPA version validation only (no release work). Only requires -v version flag.

  --snapshot         Rather than pick the latest snapshot, use a specific older one, eg., rhdh-1-6-lsbrr
  --snapshot-state   Search for snapshots in a different state than the default 'completed', eg. 'queued'

  --stage, --prod    Push to the stage or prod version of the RH Ecosystem Catalog
  -c                 Space-separated list of containers to release
                     use \"rhdh-operator-bundle:1.y-zzz\" to release a specific bundle and its operands (hub + operator); or,
                     use \"rhdh-operator-bundle\" to calculate the latest bundle and release that + its operands
  -v                 RHDH version x.y.z to release
  
Releases can be found at:
https://konflux-ui.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/ns/rhdh-tenant/applications/rhdh-${RHDH_VERSION_INPUT}/releases/"
}

usageFBCs () {
  echo "\

==============================
Usage - for IIB / FBC updates:
==============================

!!! Note: you MUST RE-RENDER and RE-BUILD your FBCs before pushing to production !!! 
!!! Also make sure that you have fetched the latest contents from the production index when rendering. !!! 
!!! See ../renderCatalogs.sh for more info, and use the --rhec flag to trigger new FBC builds. !!

# 1. oc login as above

oc login ...

# 2. render new catalogs using the --rhec flag
./build/scripts/renderCatalogs.sh -v $RHDH_FULL_VERSION_INPUT --default --rhec

# 3. once fully rendered at https://konflux-ui.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/ns/rhdh-tenant/applications/fbc-4-18/activity/pipelineruns 
#    (and other supported versions), you can run this script!

# 4a. for releasing FBCs after containers are already live
$0 --prod   --fbc :1.7.0 --debug --auto

# 4b. or use SHA
$0 --prod   --fbc @sha256:2981d2470951ea1e26eb968aefc39ab48ab7d9634a520cf2bbd8c5fef313db15 -v 1.7.0 --auto


Options:
  --stage, --prod    Push to the stage or prod version of the RH Ecosystem Catalog
  -v                 RHDH version x.y.z to release

  --fbc              Publish FBCs for the specified bundle tag, eg., 1.3-133 or 1.4.2
  --snapshot         Rather than pick the latest snapshot, use a specific older one, eg., fbc-4-18-znfg9
  --snapshot-state   Search for snapshots in a different state than the default 'completed', eg. 'queued'
  --commit           Rather than pick the latest snapshot, use a specific older one matching a commit SHA, eg., 8ce7098e
  -o                 OCP versions for which to release FBC; default '$OCP_VERSIONS'

  --auto             Rather than showing you the yaml to apply, just execute it automatically. Be careful!
  --skip-rpa-check   Skip validation of RPA (Release Pipeline Automation) version configuration. NOT RECOMMENDED.
  --test-rpa-check   Test the RPA version validation only (no release work). Only requires -v version flag.
  "
}

# break if not logged in
OCwhoami=$(oc whoami 2>&1 || true)
if [[ $OCwhoami == *"You must be logged in"* ]] || [[ $OCwhoami == *"cannot get resource"* ]] || [[ $OCwhoami == *"Error"* ]] || [[ $OCwhoami == *"Forbidden"* ]]; then 
  usage
  echo; echo -e "${red}$OCwhoami\n[ERROR] You must be logged into the konflux console!${norm}"; echo
  exit 1
fi

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '--debug') DEBUG=1;;
    '-v') RHDH_FULL_VERSION="$2"; shift 1;;
    '-o') OCP_VERSIONS="$2"; shift 1;;
    '--stage'|'--prod') DEST=${1/--/};;
    '--auto') AUTORELEASE=1;;
    '--force') FORCE=1;;
    '--fbc') BUNDLE_TAG_OR_SHA=$2; shift 1;;
    '--snapshot') SNAPSHOT_OVERRIDE=$2; shift 1;;
    '--snapshot-state') SNAPSHOT_STATE="$2"; shift 1;;
    '--commit')   midstreamCommitSHA="$2"; shift 1;;
    '-c') CONTAINER="$2"; shift 1;;
    '--cve') CVEListFile="$2"; shift 1;;
    '--cve-all') CVE_INCLUDE_ALL=1;;
    '--issues') ISSUES="$2"; shift 1;;
    '--bz') BZ="$2"; shift 1;;
    '--skip-rpa-check') SKIP_RPA_CHECK=1;;
    '--test-rpa-check') TEST_RPA_ONLY=1;;
    '--help') usage; usageContainers; usageFBCs; exit 0;;
    *) usage; usageContainers; usageFBCs; echo; echo -e "${red}[ERROR] Unknown flag ${1}${norm}"; exit 1;;
  esac
  shift 1
done

function openURL {
    if [[ $(command -v google-chrome) == *"google-chrome"* ]] || [[ $(which google-chrome 2>&1) != *"which: no google-chrome"* ]]; then 
        google-chrome "$1" >/dev/null 2>&1
    else 
        echo " >> $1"
    fi
}

# Generate MR to update RPA configuration
generateRPAMergeRequest() {
  local version_xyz="$1"
  local version_xy="${version_xyz%.*}"  # 1.7.8 -> 1.7
  local gh_branch="release-${version_xy}"    # release-1.7
  local midstream_branch="rhdh-${version_xy}-rhel-9"  # rhdh-1.7-rhel-9

  local version_for_tagrelease="${version_xyz%.*}.$(( ${version_xyz##*.} - 1 ))"  # 1.7.1 -> 1.7.0

  echo
  echo -e "${blue}[INFO] Generating MR to update RPA configuration for version ${version_xyz}...${norm}"
  echo -e "${blue}[INFO] Using tagRelease.sh with version ${version_for_tagrelease} to configure ${version_xyz}${norm}"

  # Call tagRelease.sh to update the konflux-release-data RPA files.
  # This bumps RPAs to the next Z (getNextCSVZ) based on the CSV_VERSION provided.
  local tagRelease_output
  local tagRelease_exit_code

  tagRelease_output="$("${SCRIPT_DIR}/tagRelease.sh" \
    -v "${version_for_tagrelease}" \
    -t "${version_xy}" \
    -gh "${gh_branch}" \
    --midstream-branch "${midstream_branch}" \
    --clean \
    --force-update \
    --nobuild \
    --skip-gh \
    --skip-gl \
    --skip-prodsec \
    --skip-pyxis 2>&1)"
  tagRelease_exit_code=$?

  # Always log the output for debugging purposes
  if [[ -n "$tagRelease_output" ]]; then
    echo -e "${blue}[INFO] tagRelease.sh output:${norm}"
    echo "$tagRelease_output"
  fi

  if [[ $tagRelease_exit_code -eq 0 ]]; then
    echo -e "${green}[SUCCESS] RPA configuration update completed successfully${norm}"
    return 0
  else
    echo -e "${red}[ERROR] Failed to update RPA configuration using tagRelease.sh${norm}"
    return 1
  fi
}

# disable autorelease until we fix https://issues.redhat.com/browse/RHIDP-5840 and can automatically pull in a list of CVEs to include in the release
if [[ $CONTAINER ]]; then AUTORELEASE=0; fi

# compute numbder of OCP versions and fail if we're trying to run a specific snapshot from multiple OCP versions
num_ocp_versions=0
for OCP_VERSION in $OCP_VERSIONS; do
  (( num_ocp_versions = num_ocp_versions + 1 ))
done

if [[ $SNAPSHOT_OVERRIDE ]] && [[ $num_ocp_versions -gt 1 ]] && [[ ! $CONTAINER ]]; then
  usage; usageFBCs; echo; echo -e "${red}[ERROR] Can only specify a snapshot for a single OCP version! Use '-o 4.18' to set the OCP version for the specified snapshot $SNAPSHOT_OVERRIDE !${norm}"; exit 1
fi

if [[ ! $CONTAINER ]] && [[ ! $BUNDLE_TAG_OR_SHA ]] && [[ $TEST_RPA_ONLY -eq 0 ]]; then 
  usage; usageContainers; usageFBCs; echo; echo -e "${red}[ERROR] Must specify '-c rhdh-operator-bundle', or for FBCs, use a bundle image tag with --fbc :1.y-zzz to perfom a release!${norm}"; exit 1
fi

if [[ ! $RHDH_FULL_VERSION ]]; then
  # if --fbc flag used and NOT using the @digest form, we can deduce the RHDH_FULL_VERSION from that to save typing
  if [[ $BUNDLE_TAG_OR_SHA ]] && [[ $BUNDLE_TAG_OR_SHA != "@sha256:"* ]]; then 
    RHDH_FULL_VERSION=${BUNDLE_TAG_OR_SHA/:}
    echo -e "\n${blue}[WARNING] Using RHDH version = $RHDH_FULL_VERSION\n[WARNING] If this is incorrect, hit CTRL-C to cancel, and set an override with the -v flag.\n${norm}"
  else
    usage; 
    if [[ $CONTAINER ]] || [[ -f $CVEListFile ]]; then usageContainers; fi
    if [[ $BUNDLE_TAG_OR_SHA ]]; then usageFBCs; fi
    echo; echo -e "${red}[ERROR] Must specify full RHDH version with -v x.y.z (or --fbc :x.v.z) to perfom a release!${norm}"; exit 1
  fi
fi

if [[ ! $DEST ]] && [[ $TEST_RPA_ONLY -eq 0 ]]; then 
  usage; 
  if [[ $CONTAINER ]]; then usageContainers; fi
  if [[ $BUNDLE_TAG_OR_SHA ]]; then usageFBCs; fi;
  echo; echo -e "${red}[ERROR] Must specify --stage or --prod to perfom a release!${norm}"; exit 1
fi

if [[ $CVEListFile ]] && [[ ! -f $CVEListFile ]]; then
  usageContainers
  echo; echo -e "${red}[ERROR] Could not find file --cve $CVEListFile${norm}"; exit 1
fi

######################################################################################################################

# Preflight check: Validate RPA version configuration matches planned GA version
validateRPAVersion() {
  local expected_version="$1"
  local expected_version_pattern="${expected_version%.*}" # e.g., 1.7.0 -> 1.7
  
  echo -e "${blue}[INFO] Validating RPA version configuration for ${expected_version}...${norm}"
  
  # Check if konflux-release-data repository is accessible
  RPA_REPO_URL="https://gitlab.cee.redhat.com/releng/konflux-release-data"
  
  # Extract major.minor version for file paths (e.g., 1.7.0 -> 1-7)
  local version_for_path="${expected_version%.*}"  # 1.7.0 -> 1.7
  version_for_path="${version_for_path/./-}"       # 1.7 -> 1-7
  
  RPA_CHECK_FILES=(
    "config/stone-prod-p02.hjvn.p1/product/ReleasePlanAdmission/rhdh/rhdh-${version_for_path}-stage.yaml"
    "config/stone-prod-p02.hjvn.p1/product/ReleasePlanAdmission/rhdh/rhdh-${version_for_path}-prod.yaml"
  )
  
  local validation_failed=0
  local temp_dir="/tmp/rpa-validation-$$"
  
  # Clone or check the RPA repository
  echo -e "${blue}[INFO] Checking RPA configuration in konflux-release-data repository...${norm}"
  
  if ! git clone --depth 1 --quiet "$RPA_REPO_URL" "$temp_dir" 2>/dev/null; then
    echo -e "${red}[WARNING] Could not clone RPA repository to validate version configuration.${norm}"
    echo -e "${red}[WARNING] Please manually verify that the RPA configuration has been updated with version ${expected_version}.${norm}"
    echo -e "${red}[WARNING] See: ${RPA_REPO_URL}${norm}"
    return 0  # Allow to continue with warning
  fi
  
  # Check each configuration file for version patterns
  for file in "${RPA_CHECK_FILES[@]}"; do
    local file_path="$temp_dir/$file"
    if [[ -f "$file_path" ]]; then
      echo -e "${blue}[INFO] Checking $file for version ${expected_version}...${norm}"
      
      # Look for version patterns in the defaults.tags array
      local version_found=0

      # Use grep to check for version patterns (more reliable than complex yq parsing)
      if grep -q "\"${expected_version}\"" "$file_path" || grep -q "\"${expected_version}-{{ timestamp }}\"" "$file_path" || grep -q "${expected_version}-{{ timestamp }}" "$file_path"; then
        version_found=1
        echo -e "${green}[INFO]   ✓ Found expected version ${expected_version} in $file${norm}"
      fi

      if [[ $version_found -eq 0 ]]; then
        echo -e "${red}[ERROR]   ✗ Expected version ${expected_version} not found in defaults.tags of $file${norm}"
        if [[ $DEBUG -eq 1 ]]; then
          echo -e "${red}[DEBUG] Available tags in $file:${norm}"
          grep -o '"[^"]*"' "$file_path" | grep -E '(1\.[0-9]+\.[0-9]+|1\.[0-9]+)' | sort -u | while read -r tag; do
            echo -e "${red}[DEBUG]   - $tag${norm}"
          done
        fi
        validation_failed=1
      fi
    else
      echo -e "${red}[WARNING] RPA configuration file $file not found${norm}"
    fi
  done
  
  # Cleanup
  rm -rf "$temp_dir"
  
  if [[ $validation_failed -eq 1 ]]; then
    echo -e "${red}[ERROR] RPA version validation failed!${norm}"
    echo -e "${red}[ERROR] The RPA configuration does not appear to be updated for version ${expected_version}.${norm}"
    echo -e "${red}[ERROR] This could result in containers being tagged with incorrect versions.${norm}"
    echo -e "${red}[ERROR]${norm}"
    echo -e "${red}[ERROR] Please ensure that the following MR has been merged BEFORE running this script:${norm}"
    echo -e "${red}[ERROR] - Update RPA configuration to change version patterns from previous version to ${expected_version}${norm}"
    echo -e "${red}[ERROR] - Update patterns like \"x.y.z\" → \"${expected_version}\" and \"x.y.z-{{ timestamp }}\" → \"${expected_version}-{{ timestamp }}\"${norm}"
    echo -e "${red}[ERROR]${norm}"
    echo -e "${red}[ERROR] Repository: ${RPA_REPO_URL}${norm}"
    echo -e "${red}[ERROR] Files to check: ${RPA_CHECK_FILES[*]}${norm}"
    echo -e "${red}[ERROR]${norm}"
    echo -e "${red}[ERROR] Use --skip-rpa-check to bypass this validation (NOT RECOMMENDED).${norm}"
    return 1
  else
    echo -e "${green}[INFO] RPA version validation passed for ${expected_version}${norm}"
    return 0
  fi
}

######################################################################################################################

RHDH_VERSION=${RHDH_FULL_VERSION%.*}
LATEST_IMAGES_FILE="/tmp/imagelist_bundle_latest_$RHDH_VERSION.txt"

TS=$(date +'%y%m%d-%H%M%S' -u) # unique timestamp (e.g., 260209-185547)
# Handle test-only mode: run RPA validation check and exit
if [[ $TEST_RPA_ONLY -eq 1 ]]; then
  echo -e "${blue}[INFO] Running RPA version validation test for version $RHDH_FULL_VERSION${norm}"
  echo
  if validateRPAVersion "$RHDH_FULL_VERSION"; then
    echo
    echo -e "${green}[SUCCESS] RPA uses version $RHDH_FULL_VERSION${norm}"
    exit 0
  else
    echo
    echo -e "${red}[FAILED] RPA version validation test failed!${norm}"
    echo -e "${blue}[INFO] Attempting to automatically generate MR to fix RPA configuration...${norm}"
    generateRPAMergeRequest "$RHDH_FULL_VERSION"
    exit 1
  fi
fi
# Run RPA version validation check before proceeding with any release work
if [[ $SKIP_RPA_CHECK -eq 0 ]]; then
  if ! validateRPAVersion "$RHDH_FULL_VERSION"; then
    echo -e "${red}[ERROR] RPA version validation failed!${norm}"
    echo -e "${blue}[INFO] Attempting to automatically generate MR to fix RPA configuration...${norm}"
    generateRPAMergeRequest "$RHDH_FULL_VERSION"
    exit 1
  fi
else
  echo -e "${blue}[WARNING] Skipping RPA version validation as requested with --skip-rpa-check${norm}"
  echo -e "${blue}[WARNING] Ensure RPA configuration is correct to avoid version tagging issues!${norm}"
fi

# Convert dots to dashes for use in container tags and file names
RHDH_FULL_VERSION=${RHDH_FULL_VERSION//./-}

if [[ $CONTAINER ]]; then
  echo
  echo -n -e "${blue}[INFO] Collect bundle and related images from $CONTAINER " 
  rm -f "${LATEST_IMAGES_FILE}"

  if [[ $CONTAINER == "rhdh-operator-bundle:${RHDH_VERSION}-"* ]]; then # bundle version already specified
    latest_bundle="quay.io/rhdh/$CONTAINER"
  else
    latest_images=$("${SCRIPT_DIR}/getLatestImageTags.sh" -b "rhdh-${RHDH_VERSION}-rhel-9" --quay | sort -uV)
    latest_bundle=$(echo -e "$latest_images" | grep operator-bundle)
  fi
  echo -n "."

  echo "$latest_bundle" >> "${LATEST_IMAGES_FILE}"
  "${SCRIPT_DIR}/checkImagesInCSV.sh" -q -y "$latest_bundle" -i 'hub|operator' >> "${LATEST_IMAGES_FILE}"
  sort -uV "${LATEST_IMAGES_FILE}" > "${LATEST_IMAGES_FILE}_"; mv "${LATEST_IMAGES_FILE}"{_,}

  # if we passed in a specific bundle, no need to check if it refers to the latest
  if [[ $CONTAINER == "rhdh-operator-bundle:${RHDH_VERSION}-"* ]]; then # bundle version already specified
    latest_images="$(cat "${LATEST_IMAGES_FILE}")"
  fi
  echo -e ". done.${norm}"
  # check for quay images in quay and csv refs to r.r.io
  if [[ $FORCE -eq 1 ]]; then
    echo
    echo -e "${blue}[WARNING] Latest images (quay.io) ~= images in $latest_bundle (r.r.io) !${norm}"
    echo -e "${blue}=================== latest hub + operator images ===================${norm}"
    echo -e "$latest_images" | grep -v operator-bundle
    echo -e "${blue}=================== latest hub + operator images ===================${norm}"
    echo
    echo -e "${blue}=================== latest bundle ===================${norm}"
    grep operator-bundle "${LATEST_IMAGES_FILE}"
    echo -e "${blue}=================== latest bundle ===================${norm}"
    echo
  elif [[ "$(cat "${LATEST_IMAGES_FILE}")" != "$latest_images" ]]; then
    echo
    echo -e "${red}[ERROR] Latest images != images in $latest_bundle !${norm}"
    echo -e "${red}=================== latest hub + operator images ===================${norm}"
    echo -e "$latest_images" | grep -v operator-bundle
    echo -e "${red}=================== latest hub + operator images ===================${norm}"
    echo
    echo -e "${red}=================== latest bundle ===================${norm}"
    grep operator-bundle "${LATEST_IMAGES_FILE}"
    echo -e "${red}=================== latest bundle ===================${norm}"
    echo -e "\n${red}Rebuild the operator-bundle to pick up the latest hub + operator images!${norm}"
    exit 1
  else
    if [[ $DEBUG -eq 1 ]]; then
      echo -e "\n${blue}[DEBUG] Related images in $latest_bundle :"
      while IFS= read -r line; do
        echo "        > $line"
      done < <(grep -v "operator-bundle" "${LATEST_IMAGES_FILE}")
    fi
    echo -e "${norm}"
  fi

  echo -e "${blue}[INFO] Inspecting SBOMs:${norm}"
  # Loop over each image to check if sbom tags exist
  for image in $latest_images; do
    # Extract the registry/repo and the tag
    repo="${image%:*}"   # e.g., quay.io/rhdh/rhdh-hub-rhel9
    # tag="${image##*:}"   # e.g., 1.5-203

    SHA=$(skopeo inspect "docker://${image}" 2>/dev/null | jq -r '.Digest' | tr ":" "-")
    # if we checked registry.redhat.io/rhdh/rhdh-hub-rhel9:1.6-110 and couldn't find it, then we need to get the SHA another way
    if [[ ! $SHA ]]; then 
      # check quay for the matching tag instead
      SHA=$(skopeo inspect "docker://${image/registry.redhat.io/quay.io}" | jq -r '.Digest' | tr ":" "-")
    fi
    SBOM_TAG="${SHA}.sbom"

    # Use skopeo to inspect the image we want (using list-tags takes ~9s; inspect takes 0.02s)
    if skopeo inspect --raw "docker://${repo}:${SBOM_TAG}" >/dev/null 2>&1; then
      if [[ ! $QUIET ]]; then echo -e "${green} * ${repo}:${SBOM_TAG} (for ${image#*/})${norm}"; fi
    else
      echo -e "${red}[ERROR]: ${repo}:${SBOM_TAG} NOT found for $image ! Rebuild required to create SBOM.${norm}"
      exit 1
    fi
  done
fi

# shellcheck disable=SC2086
if [[ ! $QUIET ]]; then echo; fi

# collect array of processed images so we don't process duplicate snapshots
declare -A processed_images

# for container pushes, not FBCs
if [[ $CONTAINER ]]; then 
  # compute the container image SHA/tag - skopeo inspect
  if [[ $CONTAINER == "rhdh-operator-bundle:${RHDH_VERSION}-"* ]]; then # bundle version already specified
    skopeo inspect "docker://quay.io/rhdh/${CONTAINER}" > /tmp/container_inspect.txt
  else
    skopeo inspect "docker://quay.io/rhdh/${CONTAINER}:${RHDH_VERSION}" > /tmp/container_inspect.txt
  fi
  CONTAINER="${CONTAINER%:*}" # trim off the trailing 1.y-zzz tag if present
  tagXYZ=$(jq -r '.Labels.version+"-"+.Labels.release' /tmp/container_inspect.txt)
  digest=$(jq -r '.Digest' /tmp/container_inspect.txt)
  echo -e "${blue}Bundle info:${norm}\n * $CONTAINER:${tagXYZ}@${digest}\n * built on $(jq -r '.Labels."build-date"' /tmp/container_inspect.txt)\n * from $(jq -r '.Env[]|select(.|contains("UPSTREAM_REPO"))' /tmp/container_inspect.txt)"

  processed_images["${CONTAINER}:${tagXYZ}"]+="${CONTAINER}@${digest}"

  # TODO: should we compute the midstream commit SHA based on $latest_bundle, not the RHDH_VERSION (want 1.4-166, not 1.4) ? 
  # if the floating tag points to an older build (because of a build glitch) the next step will fail because 1.4 != 1.4-166)

  MID_SHA=$(jq -r '.Labels."vcs-ref"' /tmp/container_inspect.txt)
  MID_SHA=${MID_SHA/sha256:/}

  # using midstream commit SHA and the container image, find Snapshot(s_)
  if [[ $SNAPSHOT_OVERRIDE ]]; then
    echo; echo -e "${blue}[INFO] Use snapshot override = $SNAPSHOT_OVERRIDE${norm}"
    SNAPSHOT="${SNAPSHOT_OVERRIDE}"
  else 
    if [[ $DEBUG -eq 1 ]]; then set -x; fi
    SNAPSHOT=$(oc -n rhdh-tenant get Snapshots --sort-by=.metadata.creationTimestamp \
      --selector='pac.test.appstudio.openshift.io/original-prname='"${CONTAINER/-rhel9/}"'-'"${RHDH_VERSION/./-}"',pac.test.appstudio.openshift.io/sha='"${MID_SHA}"| \
      sed -r -e '/NAME +AGE/d' -e "s/([a-z0-9-]+)\ +([0-9smhdy]+)/\1/g")
    if [[ $DEBUG -eq 1 ]]; then set +x; fi
  fi

  if [[ ! $SNAPSHOT ]]; then
    echo -e "${red}[ERROR] No Snapshots found for ${CONTAINER/-rhel9/}-${RHDH_VERSION/./-} and sha=${MID_SHA}! ${norm}"
    exit 1
  fi

  if [[ ! $SNAPSHOT_OVERRIDE ]]; then 
    echo; echo -e "${blue}[INFO] For midstream SHA = $MID_SHA, found these snapshot(s):${norm}\n$SNAPSHOT"
    # TODO fail if we find more than one snapshot for this image; exit 1
  fi
  SNAPSHOTS="${SNAPSHOTS} ${SNAPSHOT}"
  rm -f /tmp/container_inspect.txt
  echo 
fi

# get the list of CVE by ID and container reference
cves_yaml=""
references_yaml=""
getCVElist () {
  if [[ $DEBUG -eq 1 ]]; then echo; fi
  # read CVEListFile: find the CVE (2), Container (5), and Resolution (7) columns; combine with " ; "; strip spaces; omit the header row with tail
  for line in $(awk -F "\"*,\"*" '{print $2,";",$5,";",$7}' "$CVEListFile" | tr -d " " | tail --lines=+2); do 
    #split into CVE ID and component
    CVE_ID=${line%%;*}
    component=${line#*;}
    component=${component%;*}
    if [[ $component == *"hub"* ]]; then 
      component="rhdh-hub-${RHDH_VERSION/./-}"
    elif [[ $component == *"operator"* ]]; then 
      component="rhdh-operator-${RHDH_VERSION/./-}"
    else
      component="UNKNOWN"
    fi
    # echo ":CVE: $line"
    CVE_STATUS="$(echo "${line##*;}" | tr -d '\n')"
    if [[ $component != "UNKNOWN" ]]; then
      if [[ $CVE_STATUS == "ReleasePending"* ]] || [[ $CVE_INCLUDE_ALL -eq 1 ]]; then
        cves_yaml="$cves_yaml
        - key: $CVE_ID
          component: $component"
        references_yaml="$references_yaml
        - \"https://access.redhat.com/security/cve/$CVE_ID\""
      else
        if [[ $DEBUG -eq 1 ]]; then
          echo -e "${blue}[INFO] Skip $CVE_ID; status = $CVE_STATUS${norm}"
        fi
      fi
    fi
  done
}

collectIssues ()
{
  # get list as space-separated in case given as comma-separated
  ISSUES="${ISSUES//,/ }"
  if [[ ! $advisoryType ]]; then
    advisoryType="RHBA"
  fi
  i_count=0
  fixed_issues=""

  # jiras
  for iss in $ISSUES; do
    (( i_count = i_count + 1 ))
    references_yaml="$references_yaml
        - \"https://issues.redhat.com/browse/$iss\""
    fixed_issues="$fixed_issues
          - id: \"$iss\"
            source: issues.redhat.com"
  done

  # bugzillas
  BZ="${BZ//,/ }"
  for bz in $BZ; do
    (( i_count = i_count + 1 ))
    references_yaml="$references_yaml
        - \"https://bugzilla.redhat.com/show_bug.cgi?id=$bz\""
    fixed_issues="$fixed_issues
          - id: \"$bz\"
            source: bugzilla.redhat.com"
  done

  if [[ $i_count -gt 0 ]]; then 
    advisoryType="${advisoryType}
      issues:
        fixed: $fixed_issues"
  fi
}

# TODO now compute the images in the bundle snapshot to make sure we have one that contains all the latest/correct images; if not all are present, fail!
for SNAPSHOT in $SNAPSHOTS; do
  SNAPSHOT_IMAGES_FILE="/tmp/imagelist_$SNAPSHOT.txt"
  if [[ ! -v processed_images["$SNAPSHOT"] ]]; then # process this new one
    rm -f "${SNAPSHOT_IMAGES_FILE}"
    echo -e "${blue}[INFO] Inspecting $SNAPSHOT:${norm}"
    
    oc -n rhdh-tenant get Snapshot "$SNAPSHOT" -o yaml > /tmp/"$SNAPSHOT".yaml
    # collect 3 images
    for i in $(yq -r '.spec.components[].containerImage' /tmp/"$SNAPSHOT".yaml | sort -uV); do 
      imageAndTag="$("${SCRIPT_DIR}/getTagForSHA.sh" "$i" -q -y)" 
      echo -e " * $imageAndTag = $i"
      echo "$imageAndTag" >> "${SNAPSHOT_IMAGES_FILE}"
    done
    echo

    # check for quay images in quay and csv refs to r.r.io
    sorted1="$(sed -r -e "s@registry.redhat.io/rhdh/@quay.io/rhdh/@g" "${LATEST_IMAGES_FILE}" | sort)"
    sorted2="$(sed -r -e "s@registry.redhat.io/rhdh/@quay.io/rhdh/@g" "${SNAPSHOT_IMAGES_FILE}" | sort)"
    if [[ $FORCE -eq 1 ]] && [[ "${sorted1}" == "${sorted2}"  ]]; then
      echo
      echo -e "${blue}[WARNING] Latest images in bundle (r.r.io) ~= images in snapshot (quay.io) !${norm}"
      echo -e "${blue}=================== latest hub + operator images ===================${norm}"
      cat "${LATEST_IMAGES_FILE}"
      echo -e "${blue}=================== latest hub + operator images ===================${norm}"
      echo
      echo -e "${blue}=================== snapshot =================${norm}"
      cat "${SNAPSHOT_IMAGES_FILE}"
      echo -e "${blue}=================== snapshot =================${norm}"
      echo
    elif [[ "$(cat "${LATEST_IMAGES_FILE}")" != "$(cat "${SNAPSHOT_IMAGES_FILE}")" ]]; then
      echo -e "${red}[ERROR] Latest images in bundle != images in snapshot:${norm}"
      echo -e "${red}=================== latest hub + operator images ===================${norm}"
      cat "${LATEST_IMAGES_FILE}"
      echo -e "${red}=================== latest hub + operator images ===================${norm}"
      echo
      echo -e "${red}=================== snapshot =================${norm}"
      cat "${SNAPSHOT_IMAGES_FILE}"
      echo -e "${red}=================== snapshot =================${norm}"
      echo -e "\n${red}If the images are the same (but hub and operator have already been released\nto registry.redhat.io), you can re-run with the --force flag to proceed!${norm}"
      exit 
    else
      echo -e "${green}[INFO] Snapshot images match latest images - release can proceed for the following containers:${norm}"
      while IFS= read -r line; do
        echo -e "${blue}       > ${line}${norm}"
      done < "${SNAPSHOT_IMAGES_FILE}"
    fi
    rm -f "${SNAPSHOT_IMAGES_FILE}" "${LATEST_IMAGES_FILE}"

    # by default assume we're doing a RHSA, unless the --rhba flag is set
    if [[ $CVEListFile ]] && [[ ! $advisoryType ]]; then
      # compute $cves_yaml and $references_yaml
      getCVElist "$CVEListFile"
      if [[ $cves_yaml != "" ]] || [[ $references_yaml != "" ]]; then
        refs_cnt=0
        for ref in $references_yaml; do 
          if [[ $ref != "-" ]]; then (( refs_cnt = refs_cnt + 1 )); fi 
        done
        echo -e "${green}\n[INFO] Found $refs_cnt CVEs to include in this release${norm}"
        if [[ $DEBUG -eq 1 ]]; then
          for ref in $references_yaml; do
            if [[ $ref != "-" ]]; then echo "        > ${ref//\"}"; fi
          done
        fi
        advisoryType="RHSA"
        # prepend section header only for RHSA as an empty .cves section will confuse conforma
        cves_yaml="      cves: $cves_yaml"
        collectIssues
      else
        echo -e "${red}\n[ERROR] Could not find CVEs in $CVEListFile to include in this release. If this is expected, omit the --cve flag and run this script again with the --rhba flag.${norm}"
        exit 1
      fi
    else
      if [[ ! $advisoryType ]]; then
        echo -e "${green}\n[INFO] Advisory set to RHBA with fixed issue(s): $ISSUES${norm}"
        collectIssues
      fi
    fi

    echo
    cat << EOT > "/tmp/release-${SNAPSHOT}-${DEST}-${TS}.yaml"
apiVersion: appstudio.redhat.com/v1alpha1
kind: Release
metadata:
  name: release-${RHDH_FULL_VERSION}-${SNAPSHOT}-${DEST}-${TS}
  namespace: rhdh-tenant
  labels:
    release.appstudio.openshift.io/author: $(oc whoami)
spec:
  releasePlan: rhdh-${RHDH_VERSION/./-}-${DEST}
  snapshot: ${SNAPSHOT}
  data:
    releaseNotes:
      synopsis: Red Hat Developer Hub ${RHDH_FULL_VERSION//-/.} release.
      topic: Red Hat Developer Hub ${RHDH_FULL_VERSION//-/.} has been released.
      type: $advisoryType
      references: 
        - "https://developers.redhat.com/rhdh/overview"
        - "https://docs.redhat.com/en/documentation/red_hat_developer_hub"
        - "https://catalog.redhat.com/search?gs&searchType=containers&q=rhdh" $references_yaml
$cves_yaml
EOT
    # if [[ $DEBUG -eq 1 ]]; then cat "/tmp/release-${SNAPSHOT}-${DEST}-${TS}.yaml"; fi
    if [[ $AUTORELEASE -eq 1 ]]; then
      echo -n "[INFO] "
      oc apply -f "/tmp/release-${SNAPSHOT}-${DEST}-${TS}.yaml"
      echo

      # now check for maanged pipeline runs
      # for release-rhdh-1-4-4p59p-stage-20250115-210603, get rhtap-releng-tenant/managed-cc5zr
      managedPipeline=$(oc -n rhdh-tenant get Releases --sort-by=.metadata.creationTimestamp -o yaml | yq -r '.items[]|select(.metadata.name|startswith("'"release-${RHDH_FULL_VERSION}-${SNAPSHOT}-${DEST}-${TS}"'"))' | grep pipelineRun | sed -r -e "s|.+rhtap-releng-tenant/(.+)\",|\1|")
      if [[ $managedPipeline ]]; then
        managedPipelineURL="https://konflux-ui.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/ns/rhtap-releng-tenant/applications/rhdh-${RHDH_VERSION/./-}/pipelineruns/${managedPipeline}/taskruns"
        echo -e -n "${green}[INFO] Run in $managedPipelineURL\n       and "
      else 
        echo -e -n "${blue}[INFO] Run in "
      fi
      RELEASE_URL="https://konflux-ui.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/ns/rhdh-tenant/applications/rhdh-${RHDH_VERSION/./-}/releases/release-${RHDH_FULL_VERSION}-${SNAPSHOT}-${DEST}-${TS}"
      echo -e "$RELEASE_URL${norm}"

      # open a browser to watch the release
      openURL "$managedPipelineURL"
      echo "-----------------------------------------------------------------------"
      echo
    else
      collected_commands="${collected_commands}\n  oc apply -f /tmp/release-${SNAPSHOT}-${DEST}-${TS}.yaml"
      echo -e "Run this:\n   oc apply -f /tmp/release-${SNAPSHOT}-${DEST}-${TS}.yaml"; echo 
      releasesURL="https://konflux-ui.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/ns/rhdh-tenant/applications/rhdh-${RHDH_VERSION/./-}/releases/"
      echo -e "Then watch Release at\n   ${green}${releasesURL}${norm}"
      openURL "$releasesURL"
      echo -e "\nOr for a list of Releases:\n   oc -n rhdh-tenant get Releases --sort-by=.metadata.creationTimestamp -o yaml > /tmp/releases.yaml"
    fi
  fi
done
rm -fr /tmp/container_inspect.txt

###############################################################################################################

# process the FBCs the same way for all the valid arches (x86_64 for now) and OCP versions (4.16+)
collected_commands=""
if [[ $BUNDLE_TAG_OR_SHA ]]; then 
  declare -A operator_bundle_mapping
  
  # compute the correct operator bundle 
  CONTAINER_PRE="registry.redhat.io/rhdh"
  # shellcheck disable=SC2143
  if [[ $(skopeo inspect --raw "docker://${CONTAINER_PRE}/rhdh-operator-bundle${BUNDLE_TAG_OR_SHA}" 2>&1 | grep "Error parsing") ]]; then
    # fall back to checking quay, if the image is not yet released
    CONTAINER_PRE="quay.io/rhdh"
    if [[ $(skopeo inspect --raw "docker://${CONTAINER_PRE}/rhdh-operator-bundle${BUNDLE_TAG_OR_SHA}" 2>&1 | grep "Error parsing") ]]; then
      echo -e "${red}[ERROR] Could not find operator bundle from specifed tag or SHA! Try this again to get a valid tag:${norm}"
      echo "  skopeo inspect --raw docker://${CONTAINER_PRE}/rhdh-operator-bundle${BUNDLE_TAG_OR_SHA}";
      exit 1
    fi
  fi
  echo -e "${blue}Inspecting ${CONTAINER_PRE}/rhdh-operator-bundle${BUNDLE_TAG_OR_SHA} ..."
  time skopeo inspect "docker://${CONTAINER_PRE}/rhdh-operator-bundle${BUNDLE_TAG_OR_SHA}" > /tmp/fbc_inspect.txt
  echo -e "${norm}"
  tagXYZ=$(jq -r '.Labels.version+"-"+.Labels.release' /tmp/fbc_inspect.txt)
  digest=$(jq -r '.Digest' /tmp/fbc_inspect.txt)
  operator_bundle_mapping["rhdh-operator-bundle:${tagXYZ}"]+="rhdh-operator-bundle@${digest}"

  BRANCH="rhdh-${RHDH_VERSION}-rhel-9"

  for OCP_VERSION in $OCP_VERSIONS; do
    OCP_VERSION=${OCP_VERSION/./-} # replace . with -
    # # compute the correct fbc Snapshot with these filters:
    # pac.test.appstudio.openshift.io/branch: rhdh-1.4-rhel-9
    # pac.test.appstudio.openshift.io/original-prname: fbc-4-18-on-push
    # pac.test.appstudio.openshift.io/sha: 7e6c56d5dccb86c37e26672e40ed3a0a9bcd28a2

    oc -n rhdh-tenant get Snapshots --sort-by=.metadata.creationTimestamp --selector='pac.test.appstudio.openshift.io/original-prname=fbc-'"${OCP_VERSION}"'-on-push' -o yaml > "/tmp/fbc-snapshots-${OCP_VERSION}.yaml"

    extraSelect=""
    if [[ $midstreamCommitSHA ]]; then 
      extraSelect='|select(.metadata.labels."pac.test.appstudio.openshift.io/sha" | startswith("'"$midstreamCommitSHA"'"))'
    fi
    if [[ $SNAPSHOT_OVERRIDE ]]; then 
      extraSelect='|select(.metadata.name == "'"$SNAPSHOT_OVERRIDE"'")'
    fi

    pipelinerunfinishtime=""
    if [[ $DEBUG -eq 1 ]]; then
      echo "Found snapshot(s):"
      echo -e "finish timestamp\tsnapshot\tpipelinerun\t\tmidstreamCommitSHA"
    fi
    yq -r '.items[]|select(.metadata.annotations."pac.test.appstudio.openshift.io/branch" == "'"${BRANCH}"'")|select(.metadata.labels."pac.test.appstudio.openshift.io/state" == "'"${SNAPSHOT_STATE}"'")'"$extraSelect"'|.metadata.labels."test.appstudio.openshift.io/pipelinerunfinishtime" + "\t" + .metadata.name + "\t" + .metadata.labels."appstudio.openshift.io/build-pipelinerun" + "\t" + .metadata.labels."pac.test.appstudio.openshift.io/sha"' "/tmp/fbc-snapshots-${OCP_VERSION}.yaml" > "/tmp/fbc-snapshots-${OCP_VERSION}.csv"
    # 1734044836	fbc-4-18-mhchr	fbc-4-18-on-push-s687p	76ada30bafa4341c6032496c1aa64d8c8a452947
    # 1734194561	fbc-4-18-d766t	fbc-4-18-on-push-g9fpp	7e6c56d5dccb86c37e26672e40ed3a0a9bcd28a2
    # get the 5 most recent ones 
    tail -5 "/tmp/fbc-snapshots-${OCP_VERSION}.csv" > "/tmp/fbc-snapshots-${OCP_VERSION}.csv_"
    mv -f "/tmp/fbc-snapshots-${OCP_VERSION}.csv"{_,}
    while IFS= read -r line; do
      pipelinerunfinishtime=${line%%$'\t'*} # first column
      pipelinerunfinishtime=$(date --date="@${pipelinerunfinishtime}" +'%Y-%m-%dT%H:%M:%SZ' -u) # 2024-12-23T21:43:32Z

      snapshotdata=${line#*$'\t'}
      snapshotdata=${snapshotdata%$'\t'*} #middle columns

      midstreamCommitSHA_URL="https://gitlab.cee.redhat.com/rhidp/rhdh/-/commit/${line##*$'\t'}" # last column

      if [[ $DEBUG -eq 1 ]]; then
        echo -e "$pipelinerunfinishtime\t$snapshotdata\t${midstreamCommitSHA_URL}"
      fi
    done < "/tmp/fbc-snapshots-${OCP_VERSION}.csv"
    if [[ $DEBUG -eq 1 ]]; then echo; fi

    # TODO should we reverse the sort and start processing them from most recent to oldest, find the iib image, and extract that to pull out the referenced operator-bundle image for this release; stop after the first good one

    # pick the last (or only) snapshot
    SNAPSHOT=$(yq -r '.items[]|select(.metadata.annotations."pac.test.appstudio.openshift.io/branch" == "'"${BRANCH}"'")|select(.metadata.labels."pac.test.appstudio.openshift.io/state" == "'"${SNAPSHOT_STATE}"'")'"$extraSelect"'|.metadata.name' "/tmp/fbc-snapshots-${OCP_VERSION}.yaml" | tail -1)
    
    if [[ ! $SNAPSHOT ]] || [[ ! $pipelinerunfinishtime ]]; then
      echo -e "${red}[ERROR] Could not find a snapshot! Try different values for the --fbc, --snapshot, and/or --commit flags.${norm}"; exit 1
    fi

    # pipelinerun: https://konflux-ui.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/ns/rhdh-tenant/applications/fbc-4-18/pipelineruns/fbc-4-18-on-push-g9fpp
    # snapshot:    https://konflux-ui.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/ns/rhdh-tenant/applications/fbc-4-18/snapshots/fbc-4-18-d766t
    echo -e "${green}For $OCP_VERSION, found snapshot (completed $pipelinerunfinishtime):"
    echo -e " * Commit:   https://gitlab.cee.redhat.com/rhidp/rhdh/-/commit/$(tail -1 "/tmp/fbc-snapshots-${OCP_VERSION}.csv" | sed -r -e "s@.+\t([^\t]+)@\1@")"
    echo -e " * Snapshot: https://konflux-ui.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/ns/rhdh-tenant/applications/fbc-${OCP_VERSION}/snapshots/$SNAPSHOT${norm}\n"

    # for each SNAPSHOT, find the iib bundle, extract its contents, and pick the last bundle reference; check if that matches the value above
    oc -n rhdh-tenant get Snapshot "${SNAPSHOT}" -o yaml > "/tmp/${SNAPSHOT}.yaml"
    IIB=$(yq -r '.spec.components[0].containerImage' "/tmp/${SNAPSHOT}.yaml") # quay.io/rhdh/iib@sha256:23eb6996df56471120723b8741ac4f19dc2d23441bdbaea62003de6fd1a507a0
    sudo rm -fr /tmp/quay.io-rhdh-iib-sha256-*
    if [[ $DEBUG -eq 1 ]]; then echo "Extracting $IIB to get catalog.json ..."; fi
    "$SCRIPT_DIR/containerExtract.sh" "${IIB}" -q
    # get all the bundles sorted by newest to oldest
    bundles=$(cat /tmp/quay.io-rhdh-iib-sha256-*/configs/rhdh/catalog.json | grep rhdh-operator-bundle@ | sed -r -e 's|.+"image": ".+/rhdh/(.+)",*|\1|' | uniq | tac)

    # TODO do we need to do this at all? and should we validate stage pushed images too?
    # if [[ $DEST == "prod" ]]; then # use prod URL
    #   bundle=$(bundle/quay.io/registry.redhat.io)
    # fi

    # cleanup exploded container
    sudo rm -fr /tmp/quay.io-rhdh-iib-sha256-*

    # grab the only quay.io entry (last one)
    PROCEED=0
    for k in "${!operator_bundle_mapping[@]}"; do 
      echo "Searching for ${operator_bundle_mapping[$k]} ($k) ..."
      for bundle in $bundles; do
        if [[ $DEBUG -eq 1 ]]; then echo -n "          ... $bundle"; fi
        if [[ ${operator_bundle_mapping[$k]} == "$bundle" ]]; then
          PROCEED=1
          if [[ $DEBUG -eq 1 ]]; 
            then echo ": matched!"; 
          else
            echo -n "   Matched on $bundle: "
          fi
          echo "Release can proceed - should take about 30 mins per OCP version"; echo
          cat << EOT > "/tmp/release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-${TS}.yaml"
apiVersion: appstudio.redhat.com/v1alpha1
kind: Release
metadata:
  labels:
    release.appstudio.openshift.io/author: $(oc whoami)
  name: release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-${TS}
  namespace: rhdh-tenant
spec:
  releasePlan: rhdh-${RHDH_VERSION/./-}-fbc-${OCP_VERSION}-${DEST}-release-plan
  snapshot: ${SNAPSHOT}
EOT
          # if [[ $DEBUG -eq 1 ]]; then cat "/tmp/release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-${TS}.yaml"; fi
          if [[ $AUTORELEASE -eq 1 ]]; then
            oc apply -f "/tmp/release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-${TS}.yaml"
            echo
            RELEASE_URL="https://konflux-ui.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/ns/rhdh-tenant/applications/fbc-${OCP_VERSION}/releases/release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-${TS}"
            echo "Run in $RELEASE_URL"
            # open a browser to watch the release
            openURL "$RELEASE_URL"
            echo "-----------------------------------------------------------------------"
            echo
          else
            collected_commands="${collected_commands}\n  oc apply -f /tmp/release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-${TS}.yaml"
            echo -e "Run this:\n  oc apply -f /tmp/release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-${TS}.yaml"; echo 
          fi
        else 
          if [[ $DEBUG -eq 1 ]]; then echo; fi
        fi
        if [[ $PROCEED -eq 1 ]]; then break; fi
      done
      if [[ $PROCEED -eq 1 ]]; then break; fi
    done
    if [[ $PROCEED -eq 0 ]]; then 
      echo -e "${red}[ERROR] Can not proceed with the release: matching operator-bundle image\n > ${operator_bundle_mapping[$k]} ($k)\n not found in\n > $IIB\n${norm}"
      echo -e "${red}[ERROR] If operator-bundle is live in RHEC, use production tag: '--fbc :1.4.2'${norm}"
      echo -e "${red}[ERROR] If staging an RC, use unreleased quay tag '--fbc :1.4-191'${norm}\n"
      echo -e "${red}[ERROR] Or, use the --commit or --snapshot flag to specify an older snapshot with the desired bundle image.${norm}"
      exit 1
    fi
  done
  
  # cleanup
  rm -f /tmp/fbc-snapshots*.yaml

  if [[ $collected_commands ]]; then
    echo
    echo "--------------------------------------------------------------------------"
    echo -e "Run the following commands to start your release(s):$collected_commands"
    echo -e "\nThen cleanup temp files with:\n  rm -f /tmp/release-rhdh-*.yaml"
    echo
  fi

  echo -e "Run this to find managed pipelines in progress and watch status (or run this script again in --debug mode, not --auto mode):\n  oc -n rhdh-tenant get Releases --sort-by=.metadata.creationTimestamp -o yaml > /tmp/releases.yaml"
  echo 

  # now search for existing running pipelines 
  declare -A managedPipeline_mapping=()
  echo "Found these releases:"
  echo -e "release name\t\t\t\t\t\trelease plan\t\t\t\tmanaged pipelinerun\tstart time\t\tend time"
  for OCP_VERSION in $OCP_VERSIONS; do
    OCP_VERSION=${OCP_VERSION/./-} # replace . with -
    oc -n rhdh-tenant get Releases --sort-by=.metadata.creationTimestamp -o yaml > "/tmp/releases-${OCP_VERSION}.yaml"
    RP="rhdh-${RHDH_VERSION/./-}-fbc-${OCP_VERSION}-${DEST}-release-plan"
    RN="release-rhdh-${RHDH_FULL_VERSION}-fbc-${OCP_VERSION}-${DEST}-"
    managedPipelines=$(yq -r '.items[]|select(.spec.releasePlan == "'"${RP}"'")|select(.metadata.name|startswith("'"${RN}"'"))|.status.managedProcessing.pipelineRun|split("/")[1]' "/tmp/releases-${OCP_VERSION}.yaml")
    if [[ $managedPipelines ]]; then 
      # echo "Got: [$managedPipelines]"
      managedPipeline_mapping["${OCP_VERSION}"]+="${managedPipelines}"
      for managedPipeline in ${managedPipelines}; do 
        # echo "Query: $managedPipeline"
        yq -r '.items[]|select(.spec.releasePlan == "'"${RP}"'")|select(.metadata.name|startswith("'"${RN}"'"))|select(.status.managedProcessing.pipelineRun|split("/")[1] == "'"$managedPipeline"'")|.metadata.name + "\t" + .spec.releasePlan + "\t'"${managedPipeline}"'\t\t" + .status.managedProcessing.startTime + "\t" + .status.managedProcessing.completionTime' "/tmp/releases-${OCP_VERSION}.yaml"
      done
    else 
      echo -e "${red} >> No Releases found for ReleasePlan $RP - submit one using the steps above.${norm}"
    fi
  done
  rm -f /tmp/releases-*
  echo
  
  if [[ ${#managedPipeline_mapping[@]} -gt 0 ]]; then 
    echo -e "${green}Found these managed pipeline releases:${norm}"
    for k in "${!managedPipeline_mapping[@]}"; do 
      for managedPipeline in ${managedPipeline_mapping[$k]}; do
        echo -e "${green}  https://konflux-ui.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/ns/rhtap-releng-tenant/applications/fbc-$k/pipelineruns/${managedPipeline}/taskruns${norm}"
      done
    done
  fi

  # cleanup tmp files
  rm -f /tmp/fbc_inspect.txt
  if [[ $AUTORELEASE -eq 1 ]]; then rm -f /tmp/release-rhdh-*.yaml; fi
fi