#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
#
# replace RAG assets URL from RAG content Containerfile
#
# requires rsync jq

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

# get current lls version
LLS_VERSION=$(jq -r '.current_version' "${ROOTPATH}/$destination_path/versions.json")

# get current RHDH documentation version
RHDH_DOCS_VERSION=$(grep "ARG RHDH_DOCS_VERSION" "${ROOTPATH}/$destination_path/Containerfile.vs" | sed -E 's/^ARG RHDH_DOCS_VERSION[= ]+("?)//; s/"?$//')

# get the url to the current release assets
RAG_ASSETS_URL="https://github.com/redhat-ai-dev/rhdh-rag-content/releases/download/rag-assets-rhdh-${RHDH_DOCS_VERSION}-lls-${LLS_VERSION}/rag-assets-rhdh-${RHDH_DOCS_VERSION}-lls-${LLS_VERSION}.tar.gz"

# replace the RAG assets url build argument with env var set to url of the current release assets
pushd "${ROOTPATH}/${destination_path}" >/dev/null || exit 1
    sed -i "s|^ARG RAG_ASSETS_URL.*|ARG RAG_ASSETS_URL=\"${RAG_ASSETS_URL}\"|" "Dockerfile.in"
popd >/dev/null || exit 1
