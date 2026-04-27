#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
#
# utility script for fetching the LCS sidecar image tag
#
# requires jq
# requires yq (python wrapper for jq)

dh_image_tag="$1"
repo=https://github.com/redhat-ai-dev/lightspeed-configs
branch0=release-${dh_image_tag}
branch1=main
if [[ $(git ls-remote --heads $repo refs/heads/$branch0 | wc -l) -eq 1 ]]; then
    branch=$branch0
elif [[ $(git ls-remote --heads $repo refs/heads/$branch1 | wc -l) -eq 1 ]]; then
    branch=$branch1
else
    echo -e "[ERROR] Could not find $branch0 or $branch1 at $repo !"; exit 1
fi
lcs_config="https://raw.githubusercontent.com/redhat-ai-dev/lightspeed-configs/refs/heads/${branch}/images.yaml"
lcs_image="$(curl -sL "${lcs_config}" | yq -r '."lightspeed-core".image')"

echo "${lcs_image##*:}"
