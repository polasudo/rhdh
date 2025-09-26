#!/usr/bin/env bash
#
# Copyright (c) 2024 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#

## compute the images and useful metadata for bundles in a FBC template or catalog json file

## sample output from a template file

# registry.redhat.io/rhdh/rhdh-operator-bundle:1.3-118@sha256:aa2551561078f59c2ac06905bbe51601a438bd8534c5240657964d6e3b685295
#  .spec.version: 1.3.1
#   .metadata.name: rhdh-operator.v1.3.1
#   .spec.replaces: rhdh-operator.v1.1.1
#   .metadata.annotations.skipRange: >=1.0.0 <1.3.1

## or for a catalog file

# registry.redhat.io/rhdh/rhdh-operator-bundle:1.3-118@sha256:aa2551561078f59c2ac06905bbe51601a438bd8534c5240657964d6e3b685295
#   .spec.version: 1.3.1
#   .metadata.name: rhdh-operator.v1.3.1
#   .spec.replaces: rhdh-operator.v1.1.1
#   .metadata.annotations.skipRange: >=1.0.0 <1.3.1
#   * registry.redhat.io/openshift4/ose-kube-rbac-proxy:v4.12.0-202410010030.p0.gb17014f.assembly.stream.el8@sha256:14d8ee2a842e7c078e9fbcbafc19851aea7b89793429a5057207b0925d306905
#   * registry.redhat.io/rhdh/rhdh-hub-rhel9:1.3-124@sha256:85fac2b994585159594e803651c888afe38ecc4978a36c600ab8e0a41016dc27
#   * registry.redhat.io/rhdh/rhdh-rhel9-operator:1.3-119@sha256:5abffa4d15350d0a89f50324707ec4d5b57c469b9812c0967e2bb3472be52dd4

QUIET="-q"
CATALOG_FILE=""

SCRIPT=$(readlink -f "$0"); SCRIPTPATH=$(dirname "$SCRIPT")

usage () {
	echo "For a catalog template (bundles) or catalog file (bundles and operands), compute a list of the contained images.
Images will be listed by tag and SHA, and bundles will unpacked to provide a summary of the bundle metadata including:
* version + name
* replaces, skipRange, and olm.substitutesFor annotations
* related images (operands)

Depending on the size of your template or catalog file, this might take over 4 mins to process.

Requires: jq

Usage: 
  $0 -f catalogs/v4.18/catalog-template.json
  $0 -f catalogs/v4.18/configs/rhdh/catalog.json
"
exit
}

if [[ $# -lt 1 ]]; then usage; fi

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-f') CATALOG_FILE="$2"; shift 2;;
    '-v') QUIET=""; shift 1;;
   *) echo "Invalid flag."; usage;;
  esac
done

if [[ ! $CATALOG_FILE ]] || [[ ! -f $CATALOG_FILE ]]; then usage; fi

getTag="${SCRIPTPATH}/getTagForSHA.sh"
if [[ ! -x ${SCRIPTPATH}/getTagForSHA.sh ]]; then
    getTag="/tmp/getTagForSHA.sh"
    curl -sSLo "$getTag" "https://gitlab.cee.redhat.com/rhidp/rhdh/-/raw/rhdh-1-rhel-9/build/scripts/getTagForSHA.sh" && chmod +x "$getTag"
fi

extract="${SCRIPTPATH}/containerExtract.sh"
if [[ ! -x ${SCRIPTPATH}/containerExtract.sh ]]; then
    extract="/tmp/containerExtract.sh"
    curl -sSLo "$extract" "https://gitlab.cee.redhat.com/rhidp/rhdh/-/raw/rhdh-1-rhel-9/build/scripts/containerExtract.sh" && chmod +x "$extract"
fi

# collect array of processed images so we don't process duplicate entries
declare -A processed_images

if [[ $CATALOG_FILE == *"template"* ]]; then
  entries="$(jq -r '.entries[]|select(.schema == "olm.bundle")|.image' "$CATALOG_FILE")"
else
  entries="$(jq -r '.|select(.schema == "olm.bundle")|.image, .relatedImages[].image, "\n"' "$CATALOG_FILE")"
fi
for d in $entries; do 
  if [[ ! -v processed_images["$d"] ]]; then
    TAG=$($getTag "$d" -y -q)
    if [[ $d != *"bundle"* ]]; then
      # operands are indented
      echo "  * $TAG@${d#*@}"
    else
      # bundles are not indented but have a line break
      echo; echo "$TAG@${d#*@}"

      # get the CSV version
      rm -fr /tmp/"$(echo "$d" | tr "@/:" "-")"*
      ${extract} "$d" --delete-before $QUIET
      # shellcheck disable=SC2089 disable=SC2016
      for field in ".spec.version" ".metadata.name" ".spec.replaces" ".metadata.annotations.skipRange" '.metadata.annotations."olm.substitutesFor"'; do
        val=$(yq -r --arg field "$field" $field /tmp/"$(echo "$d" | tr "@/:" "-")"*/manifests/rhdh-operator*ml 2>/dev/null)
        if [[ $val != "null" ]]; then
          echo "  $field: $val"
        fi
      done
      # clean up unpacked bundle container
      rm -fr /tmp/"$(echo "$d" | tr "@/:" "-")"*
    fi
    # collect array of processed images so we don't process duplicate entries
    processed_images["$d"]+="1"
  fi
done
