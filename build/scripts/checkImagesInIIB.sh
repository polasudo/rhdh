#!/usr/bin/env bash
#
# Copyright (c) 2023 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#

# for a given IIB container, check the RELATED_IMAGE's digests align to specific images

SCRIPT=$(readlink -f "$0"); SCRIPTPATH=$(dirname "$SCRIPT")

# by default resolve image tags / digests from RHEC or as stated in the CSV; with this override, check Quay if can't find in RHEC
QUAY=""
# by default resolve image tags / digests from RHEC or as stated in the CSV; with this override, check Brew if can't find in RHEC
BREW=""
# by default, show the tag :: image@sha; optionally just show image:tag
QUIET=""
QUIETER=""
# by default show all images; optionally filter for one or more, eg 'hub|postgresql'
REGEX_FILTER=""

# in case the latest bundle in the FBC is not the one you want, filter by some regex, eg., 'v1.3.'
BUNDLE_FILTER=""

# by default show tags; use this to show digests only (eg., for use with a script that copies images inside an airgap)
SHOW_DIGESTS_ONLY=""

norm="\033[0;39m"
green="\033[1;32m"
blue="\033[1;34m"
red="\033[1;31m"

usage () {
  echo "For a given IIB container, check that the bundle image's RELATED_IMAGE's digests align to specific images

Requires:
* jq 1.6+, yq, sudo
* opm v1.26.3+ (see https://docs.openshift.com/container-platform/4.12/cli_reference/opm/cli-opm-install.html#cli-opm-install )

Usage:
  Using a specific IIB: $0 bundle-image1 [OPTIONS]

Options:
  -y, --quay           If image not resolved from RH Ecosystem Catalog, check equivalent image on quay.io
  --brew               If image not resolved from RH Ecosystem Catalog, check equivalent image on brew.registry.redhat.io
  -i, --filter         Rather than return ALL images in the build, include a subset using grep -E
  -b, --bundlefilter   Rather than return the last operator in the FBC / IIB, filter for a specific one using grep -E
  -q, --quiet          Quiet output: show fewer steps
  -qq, --quieter       Quieter output: omit everything but related images
  --digests            Instead of showing tags, just show image digests as seen in the IIB/CSV

Examples:
  $0 brew.registry.redhat.io/rh-osbs/iib-pub-pending:v4.18 --brew --quay --filter 'dashboard|operator|registry-rhel|udi' --quiet
  $0 quay.io/rhdh/iib:1.3-v4.16-x86_64 --bundlefilter 'v1.3' --filter 'operator|hub' --quay -q
"
}

if [[ $# -lt 1 ]]; then usage; exit; fi

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-y'|'--quay') QUAY="--quay";;
    '--brew') BREW="--brew";;
    '-i'|'--filter') REGEX_FILTER="$2"; shift 1;;
    '-b'|'--bundlefilter') BUNDLE_FILTER="$2"; shift 1;;
    '-q'|'--quiet') QUIET="--quiet";;
    '-qq'|'--quieter') QUIET="--quiet"; QUIETER="true";;
    '--digests') SHOW_DIGESTS_ONLY="$1";;
    *) IMAGES="${IMAGES} $1";;
  esac
  shift 1
done

for IIB_IMAGE in $IMAGES; do
    IMAGE_PATH="$(echo "$IIB_IMAGE" | tr "/:@" "-")"
    # echo "[DEBUG] Extracting to /tmp/${IMAGE_PATH}* ..."
    rm -fr /tmp/"${IMAGE_PATH}"*/ 2>/dev/null || sudo rm -fr /tmp/"${IMAGE_PATH}"*/ 2>/dev/null  || true
    "${SCRIPTPATH}"/containerExtract.sh --delete-before --delete-after "${QUIET}" "${IIB_IMAGE}"
    tmpdir=$(find /tmp/ -type d -name "${IMAGE_PATH}*" 2>/dev/null | sort -V | tail -1)
    cd "$tmpdir" || exit 1

    # for newer file-based catalogs like OCP 4.12
    catalogJson="configs/rhdh/catalog.json"

    # for older database catalogs like OCP 4.10
    if [[ -d database ]]; then 
        if [[ $QUIETER != "true" ]]; then echo "[INFO] Converting index.db to configs folder"; fi
        pushd database >/dev/null || exit 1
        if [[ $QUIETER == "true" ]]; then 
            opm migrate index.db ../configs 1>/dev/null 2>/dev/null
        elif [[ $QUIET == "--quiet" ]]; then
            opm migrate index.db ../configs 2>/dev/null
        else 
            opm migrate index.db ../configs
        fi
        popd >/dev/null || exit 1
    elif [[ -f configs/rhdh/channel.json ]]; then # for quay.io/rhdh/iib 
        catalogJson="configs/rhdh/channel.json"
    fi
    if [[ ! -f $catalogJson ]]; then echo "[ERROR] Could not read $(pwd)/$catalogJson ! Must exit."; exit 1; fi

    # latest CSV bundle
    #    "schema": "olm.bundle",
    #    "name": "rhdhoperator.v3.4.0",
    if [[ $BUNDLE_FILTER ]]; then
      bundle=$(grep '"schema": "olm.bundle"' -A1 $catalogJson | grep -E "$BUNDLE_FILTER" | tail -1 | sed -r -e 's@.+name": "(.+)".*@\1@')
    else
      bundle=$(grep '"schema": "olm.bundle"' -A1 $catalogJson | tail -1 | sed -r -e 's@.+name": "(.+)".*@\1@')
    fi
    # alternative query for quay.io/rhdh/iib containers
    if [[ ! $bundle ]]; then
      if [[ $BUNDLE_FILTER ]]; then
        bundle=$(grep '"name":' $catalogJson | grep -E "$BUNDLE_FILTER" | tail -1 | sed -r -e 's@.+name": "(.+)".*@\1@')
      else
        bundle=$(grep '"name":' $catalogJson | tail -1 | sed -r -e 's@.+name": "(.+)".*@\1@')
      fi
    fi

    if [[ $QUIETER != "true" ]]; then echo "[INFO] Bundle Version: $bundle"; fi
    #  "image": "registry.stage.redhat.io/rhdh/rhdh-operator-bundle@sha256:478991c923cb9b432b23f4bd6f64599d82180b2ed1c7f558bc1f8335256c64e3",
    imageWithSHA=$(grep "${bundle}" -A2 $catalogJson | grep image | sed -r -e 's@.+image": "(.+)".+@\1@')
    # alternative query for quay.io/rhdh/iib containers
    if [[ ! $imageWithSHA ]]; then # instead of channel.json or catalog.json, use rhdhoperator.v1.0.0.bundle.json
        imageWithSHA=$(grep '"schema": "olm.bundle"' -A3 ${catalogJson/channel.json/${bundle}.bundle.json} | tail -1 | sed -r -e 's@.+image": "(.+)".+@\1@')
    fi

    if [[ $SHOW_DIGESTS_ONLY ]]; then 
      echo "$imageWithSHA"
    elif [[ $QUIETER != "true" ]]; then 
      echo "[INFO] Bundle Image SHA: $imageWithSHA"
    fi
    # Got quay.io/rhdh/rhdh-operator-bundle:1.0-13
    bundleContainers=$("${SCRIPTPATH}"/getTagForSHA.sh "${imageWithSHA}" ${QUAY} "${QUIET}")
    # extract the last value or the failure (tokenize to remove "For..." and "Got..." if we're not in quiet mode)
    bundleContainer=""
    for bc in $bundleContainers; do bundleContainer=$bc; done 
    if [[ "$bundleContainer" =~ ^(registry.redhat.io/rhdh/rhdh-operator-bundle:[0-9.]+)-[0-9]+ ]]; then
      # remove the -zzz since that's not in RHEC
      echo -e "${blue}[WARN] Use registry.redhat.io/rhdh/rhdh-operator-bundle:${BASH_REMATCH[1]} (not ${bundleContainer##*:})${norm}"
      bundleContainer="${BASH_REMATCH[1]}" # 1.7-67 ==> 1.7
    fi
    REGEX_FILTER_FLAG=""
    if [[ $QUIETER != "true" ]]; then 
        echo "[INFO] Bundle Image Tag: $bundleContainer"
        if [[ $REGEX_FILTER ]]; then 
            echo "[INFO] CSV contains [filter = $REGEX_FILTER]:"
            REGEX_FILTER_FLAG="-i $REGEX_FILTER"
        else
        echo "[INFO] CSV contains:"
        fi
    fi
    echo "[INFO] Get images in CSV: checkImagesInCSV.sh ${bundleContainer} ${QUAY} ${QUIET} ${BREW} ${SHOW_DIGESTS_ONLY} ${REGEX_FILTER_FLAG}"
    "${SCRIPTPATH}/checkImagesInCSV.sh" "${bundleContainer}" ${QUAY} "${QUIET}" ${BREW} "${SHOW_DIGESTS_ONLY}" "${REGEX_FILTER_FLAG}"
done
