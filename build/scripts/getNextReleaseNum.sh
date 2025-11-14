#!/usr/bin/env bash
#
# Copyright (c) 2024 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#

# script to query latest tags for a given NVR and use that to compute the next release number z for a container image tagged x.y-zzz

# get release number for a given image and make sure it's the latest NVR and wquay tag too

SCRIPT=$(readlink -f "$0"); SCRIPTPATH=$(dirname "$SCRIPT")
QUIET=0

DH_CONTAINERS="\
rhdh/rhdh-hub-rhel9 \
rhdh/rhdh-rhel9-operator \
rhdh/rhdh-operator-bundle \
"

usage () {
	echo "
Usage:  $0 -b MIDSTM_BRANCH --tag DH_VERSION -c "CONTAINER1 CONTAINER2 CONTAINER3..." [-q]
Examples:
    $0 -b rhdh-1.3-rhel-9 -c rhdh/rhdh-rhel9-operator 
    $0 -b rhdh-1-rhel-9 --tag 1.4 -q
"
}

MIDSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")
if [[ ${MIDSTM_BRANCH} != "rhdh-"*"-rhel-"* ]]; then MIDSTM_BRANCH="rhdh-1-rhel-9"; fi

CONTAINERS=""
while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-b') MIDSTM_BRANCH="$2"; shift 1;;
    '--tag') TAG="$2"; shift 1;;
    '-c') CONTAINERS="${CONTAINERS} $2"; shift 1;;
    '-q') QUIET=1;;
    '-h'|'--help') usage; exit 1;;
  esac
  shift 1
done

# default to the tag that matches the branch
if [[ ! $TAG ]] && [[ $MIDSTM_BRANCH != "rhdh-1-rhel-9" ]]; then 
    TAG=${MIDSTM_BRANCH/-rhel-9}; TAG=${TAG/rhdh-};
    if [[ "$TAG" == "1" ]]; then TAG=""; fi
fi
if [[ ! $TAG ]]; then usage; exit 1; fi

if [[ ! $CONTAINERS ]]; then CONTAINERS="${DH_CONTAINERS}"; fi;

if [[ ! -x ${SCRIPTPATH}/getLatestImageTags.sh ]]; then
    pushd "${SCRIPTPATH}" >/dev/null || exit 1
        curl -sSLO "https://gitlab.cee.redhat.com/rhidp/rhdh/-/raw/${MIDSTM_BRANCH}/build/scripts/getLatestImageTags.sh"
        chmod +x getLatestImageTags.sh
    popd >/dev/null || exit 1
fi

for c in $CONTAINERS; do 
    declare -i latest
    if [[ $QUIET -eq 0 ]]; then echo -n "$c: ${TAG}-"; fi
    # set -x
    latestQuay=$("${SCRIPTPATH}"/getLatestImageTags.sh -b "${MIDSTM_BRANCH}" -c "$c" --quay --tag "${TAG}-" 2>&1 | sed -r -e "s|.+:([0-9.]+)-([0-9]+)|\2|")
    # set +x
    # for first build on the new release stream
    if [[ $latestQuay == *"???"* ]]; then 
        latest=0
    else
        # if builds exist, increment
        latest=$(echo -e "$latestQuay" | sort -rV | head -n1) # greater of the two
        # increment to the next available value
        (( latest = latest+1 ))
    fi
    echo "$latest"
done
