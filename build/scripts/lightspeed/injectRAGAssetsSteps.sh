#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
#
# injects productized RAG assets steps into RAG content Containerfile
#
# requires rsync

# error if the required arguments are not met
if [ $# -ne 1 ]; then
    echo "expected one arguments: $0 <destination_path>"
    exit 1
fi

destination_path="$1"

SCRIPT=$(readlink -f "$0")
ROOTPATH=$(dirname "$SCRIPT"); ROOTPATH=${ROOTPATH/\/build\/scripts\/lightspeed}

# Create generation Dockerfile.in from upstream Containerfile
rsync -azq "${ROOTPATH}/$destination_path/Containerfile" "${ROOTPATH}/$destination_path/Dockerfile.in"

# replace the RAG assets url build argument and steps with using local directory
pushd "${ROOTPATH}/${destination_path}" >/dev/null || exit 1
    sed -i "s|^ARG RAG_ASSETS_URL.*|ADD ./vector-stores /tmp/rag-assets|" "Dockerfile.in"
    sed -i 's|^RUN test -n "${RAG_ASSETS_URL}" \&\& \\|RUN mkdir -p extracted \&\& \\|' "Dockerfile.in"
    sed -i '/curl -fsSL "${RAG_ASSETS_URL}" -o rag-assets.tar.gz && \\/d' "Dockerfile.in"
    sed -i '/    mkdir -p extracted \&\& \\/d' "Dockerfile.in"
popd >/dev/null || exit 1