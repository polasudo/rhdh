#!/usr/bin/env bash
#
# Copyright (c) 2024-2025 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# script to fetch the SBOM as json from a given Konflux build
#

# requires skopeo, oras, jq

set +x
set -e

# SCRIPT=$(readlink -f "$0"); 
# SCRIPTPATH=$(dirname "$SCRIPT")

CLEAN=0
QUIET=""
TMPDIR="$HOME/tmp/tmp-sbom"

usage () {
  echo "For a given container, return the SBOM

Requires:
* jq 1.6+, skopeo, oras

Usage:
  Using a specific container image (and tag or SHA): $0 repo/org/image:tag [OPTIONS]

Options:
  -q, --quiet          Quiet output: show fewer steps
  --clean              Delete temp dir before fetching sbom
  --tmpdir             Temporary dir for fetching sbom; default $TMPDIR

Examples:
  $0 quay.io/rhdh/rhdh-hub-rhel9:1.4-107 --clean --tmpdir ~/tmp/rhdh-sbom
"
}

if [[ $# -lt 1 ]]; then usage; exit; fi

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-q'|'--quiet') QUIET="--quiet";;
    '--tmpdir') if [[ $2 != "/" ]]; then TMPDIR="$2"; fi; shift 1;;
	'--clean') CLEAN="1";;
    *) IMAGES="${IMAGES} $1";;
  esac
  shift 1
done

if [[ $CLEAN -eq 1 ]]; then 
    rm -fr "${TMPDIR}"
    mkdir -p "${TMPDIR}"
fi

# eg., quay.io/rhdh/rhdh-hub-rhel9:1.4-107

for imageAndTag in $IMAGES; do
    # 1. compute digest for a given image
    image=${imageAndTag%:*}
    image=${image%@*}
    SHA=$(skopeo inspect "docker://${imageAndTag}" | jq -r '.Digest' | tr ":" "-")
    if [[ ! $QUIET ]]; then echo "For $image, got digest = $SHA"; fi

    # 2. fetch .sbom object
    oras copy "${image}:${SHA}.sbom" --to-oci-layout "${TMPDIR}" >/dev/null 2>&1

    # 3. compute which object is the .sbom
    blob=$(oras pull "${image}:${SHA}.sbom" -v 2>&1 | grep cyclonedx | sed -r -e "s|Skipped[\t ]+([a-z0-9]+).+application.+|\1|")
    if [[ ! $QUIET ]]; then echo "Got sbom blob: $blob"; fi
    
    # 4. rename the .sbom to image_tag_digest_sbom.json
    # shellcheck disable=SC2010
    blobfile="$(ls -1 "${TMPDIR}"/blobs/sha256/ | grep "$blob")"
    sbomfile="${TMPDIR}/$(echo "$imageAndTag" | tr "@:/" "_")__${SHA}.sbom.json"
    if [[ ! $QUIET ]]; then 
        echo -e "Renamed ${TMPDIR}/blobs/sha256/$blobfile to \n$sbomfile"
    else
        echo "$sbomfile"
    fi
    mv -f "${TMPDIR}/blobs/sha256/$blobfile" "$sbomfile"
done
