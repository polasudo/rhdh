#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
#
# utility script for fetching the LCS sidecar image tag
#
# requires yq (mikefarah) >= v4

# Default path matches where prepare.sh and prepareOSXARM64.sh install mikefarah yq
YQ="${YQ:-$HOME/.local/bin/yq_mf}"

dh_image_tag="$1"
repo=https://github.com/redhat-ai-dev/lightspeed-configs
branch0=release-${dh_image_tag}
branch1=main
if [[ $(git ls-remote --heads $repo refs/heads/$branch0 | wc -l) -eq 1 ]]; then
    branch=$branch0
elif [[ $(git ls-remote --heads $repo refs/heads/$branch1 | wc -l) -eq 1 ]]; then
    branch=$branch1
else
    echo "[ERROR] Could not find $branch0 or $branch1 at $repo !" >&2; exit 1
fi
lcs_config="https://raw.githubusercontent.com/redhat-ai-dev/lightspeed-configs/refs/heads/${branch}/images.yaml"
lcs_image="$(curl -sL "${lcs_config}" | $YQ '.["lightspeed-core"].image')"

if [[ -z "$lcs_image" || "$lcs_image" == "null" ]]; then
    echo "[ERROR] Could not extract lightspeed-core image from ${lcs_config}" >&2; exit 1
fi

echo "${lcs_image##*:}"
