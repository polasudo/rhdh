#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#

# Tag a bootc image build on quay.io with stable release version tags.
# This does NOT rebuild — it copies an existing image to new tags.
#
# Prerequisites: must be logged in to quay.io (podman login quay.io)

REGISTRY="quay.io/rhdh/rhdh-bootc-rhel9"

norm="\033[0;39m"
green="\033[1;32m"
blue="\033[1;34m"
red="\033[1;31m"

usage() {
    echo "
Tag a bootc build as a stable release on quay.io.

Usage:  $0 -s <source-tag> -v <version> [-b <build-num>]

Options:
    -s    Source tag (e.g. 'next', '1.9-5', or a commit SHA)
    -v    RHDH version to tag as (e.g. '1.9.4')
    -b    Optional build number (e.g. '227'). If set, also creates <version>-<build> tag.

Examples:
    $0 -s next -v 1.9.4                    # Tag latest CI build as 1.9.4
    $0 -s 1.9-5 -v 1.9.4                   # Tag stable build #5 as 1.9.4
    $0 -s 1.9-5 -v 1.9.4 -b 5             # Also creates 1.9.4-5 tag
    $0 -s abc123def -v 1.9.4               # Tag a specific commit SHA

This will create:
    ${REGISTRY}:<version>              (e.g. :1.9.4)
    ${REGISTRY}:<major.minor>          (e.g. :1.9)
    ${REGISTRY}:<version>-<build>      (e.g. :1.9.4-5, only with -b)
"
}

SOURCE=""
VERSION=""
BUILD=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        '-s') SOURCE="$2"; shift 2;;
        '-v') VERSION="$2"; shift 2;;
        '-b') BUILD="$2"; shift 2;;
        '-h'|'--help') usage; exit 0;;
        *) echo -e "${red}Unknown option: $1${norm}"; usage; exit 1;;
    esac
done

if [[ -z "$SOURCE" || -z "$VERSION" ]]; then
    echo -e "${red}Error: -s and -v are required${norm}"
    usage
    exit 1
fi

MAJOR_MINOR="${VERSION%.*}"
SOURCE_REF="${REGISTRY}:${SOURCE}"

echo -e "${blue}Source:${norm}  ${SOURCE_REF}"
echo -e "${blue}Version:${norm} ${VERSION}"
echo ""

# Verify source exists
if ! skopeo inspect "docker://${SOURCE_REF}" > /dev/null 2>&1; then
    echo -e "${red}Error: source image not found: ${SOURCE_REF}${norm}"
    exit 1
fi

# Tag with full version (e.g. 1.9.4)
echo -e "${blue}Tagging:${norm} ${REGISTRY}:${VERSION}"
skopeo copy "docker://${SOURCE_REF}" "docker://${REGISTRY}:${VERSION}" || exit 1
echo -e "${green}  ✓ ${REGISTRY}:${VERSION}${norm}"

# Tag with major.minor (e.g. 1.9)
echo -e "${blue}Tagging:${norm} ${REGISTRY}:${MAJOR_MINOR}"
skopeo copy "docker://${SOURCE_REF}" "docker://${REGISTRY}:${MAJOR_MINOR}" || exit 1
echo -e "${green}  ✓ ${REGISTRY}:${MAJOR_MINOR}${norm}"

# Tag with version-build if build number provided (e.g. 1.9.4-5)
if [[ -n "$BUILD" ]]; then
    echo -e "${blue}Tagging:${norm} ${REGISTRY}:${VERSION}-${BUILD}"
    skopeo copy "docker://${SOURCE_REF}" "docker://${REGISTRY}:${VERSION}-${BUILD}" || exit 1
    echo -e "${green}  ✓ ${REGISTRY}:${VERSION}-${BUILD}${norm}"
fi

echo ""
echo -e "${green}Done! Tagged ${SOURCE} as:${norm}"
echo -e "  ${REGISTRY}:${VERSION}"
echo -e "  ${REGISTRY}:${MAJOR_MINOR}"
if [[ -n "$BUILD" ]]; then
    echo -e "  ${REGISTRY}:${VERSION}-${BUILD}"
fi
