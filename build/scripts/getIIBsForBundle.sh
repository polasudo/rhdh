#!/bin/bash
#
# Copyright (c) 2023 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# for a given operator-bundle & tag, compute the associated IIBs for all OCP versions
# this script uses resultsdb (CVP data) to compute IIB URLs
#

VERBOSE=0
QUIET="none"
OCP_VER="v" # by default return all OCP versions

SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)

# note the extra rhdh- segment in registry-proxy.engineering.redhat.com/rh-osbs/rhdh-rhdh-operator-bundle:1.0-13
# but use IMAGE = rhdh-operator-bundle
IMAGE_DEFAULT="rhdh-operator-bundle"
IMAGE="$IMAGE_DEFAULT"

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-t') PROD_VER="$2"; shift 1;;
    '-o') OCP_VER="$2"; if [[ $OCP_VER != "v"* ]]; then OCP_VER="v${OCP_VER}"; fi; shift 1;;
    '-v') VERBOSE=1; QUIET="none"; shift 0;;
    '-q'|'-qi') VERBOSE=0; QUIET="index"; shift 0;;
    '-qb') VERBOSE=0; QUIET="bundle"; shift 0;;
  esac
  shift 1
done

usage () {
	echo "
Usage: 
  $0 -t PROD_OR_BUNDLE_VERSION [OPTIONS]

Options:
  -o OCP_VER          To limit results to a single OCP version, use this flag
  -v                  Verbose output: include additional information about what's happening
  -q, -qi             Quiet Index  output: instead of default tabbed table with operator bundle, IIB URL + OCP version; show IIB URL only
  -qb                 Quiet Bundle output: instead of default tabbed table with operator bundle, IIB URL + OCP version; show bundle only

Examples:
  $0 -t 1.0-39 -o v4.12
  $0 -t 1.0
"
}

if [[ -z ${PROD_VER} ]]; then usage; exit 1; fi
if [[ -z ${IMAGE} ]]; then usage; exit 1; fi

MIDSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")
if [[ ${MIDSTM_BRANCH} != "rhdh-"*"-rhel-"* ]]; then MIDSTM_BRANCH="rhdh-1-rhel-9"; fi

if [[ -x ${SCRIPT_DIR}/getLatestImageTags.sh ]]; then
    GLIT=${SCRIPT_DIR}/getLatestImageTags.sh
else
    if [[ $VERBOSE -eq 1 ]]; then echo "Downloading getLatestImageTags.sh script from Github"; fi
    pushd /tmp >/dev/null || exit
    curl -sSLO https://gitlab.cee.redhat.com/rhidp/rhdh/-/raw/${MIDSTM_BRANCH}/build/scripts/getLatestImageTags.sh && chmod +x getLatestImageTags.sh
    GLIT=/tmp/getLatestImageTags.sh
    popd >/dev/null || exit
fi

# note the extra rhdh- segment in registry-proxy.engineering.redhat.com/rh-osbs/rhdh-rhdh-operator-bundle:1.0-13
# but use IMAGE = rhdh-operator-bundle
VER=$(${GLIT} --osbs -c rhdh-${IMAGE} --tag ${PROD_VER})
if [[ $VERBOSE -eq 1 ]]; then echo "[DEBUG] $VER"; fi
VER=${VER##*:} # 0.17-1
resultsdbURL="https://resultsdb-api.engineering.redhat.com/api/v2.0/results/latest?testcases=cvp.redhat.detailed.operator-catalog-initialization-bundle-image&item=$IMAGE-container-$VER"
URL=$(curl -sSLk "$resultsdbURL" | jq -r '.[][].ref_url')
if [[ $VERBOSE -eq 1 ]]; then echo "[DEBUG] $URL"; fi
if [[ ! $URL ]]; then echo "[ERROR] Could not fetch ref_url from $resultsdbURL"; exit 1; fi
# filter out HTML results in case the CVP tests are still in progress and we don't have index_images.yml but $URL exists
results="$(curl -sSLk "${URL}index_images.yml" | grep -E -v "<|>" | tr -d "[]'\n " | tr "," "\n" | sed -r -e "s@(v[0-9.]+):(.+)@$IMAGE:$VER\t\2\t\1@" | grep $OCP_VER)"
if [[ -z $results ]]; then echo "[ERROR] Could not read index_images.yml from $URL"; exit 1; fi

# shellcheck disable=SC2066
for line in "$results"; do
    if [[ $QUIET == "index" ]]; then # show only the index image
        echo "$line" | sed -r -e "s#([^\t]+)\t([^\t]+)\tv.+#\2#"
    elif [[ $QUIET == "bundle" ]]; then # show only the bundle image
        echo "$line" | sed -r -e "s#([^\t]+)\t([^\t]+)\tv.+#\1#"
    else
        echo "$line"
    fi 
done
