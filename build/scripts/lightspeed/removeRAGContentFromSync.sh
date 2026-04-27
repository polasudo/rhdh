#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
#
# removes all RAG content midstream sync steps from build/ci/sync-midstream.sh
# **this is for removing in favor of OKP image deployments in future releases**

SCRIPT=$(readlink -f "$0")
ROOTPATH=$(dirname "$SCRIPT"); ROOTPATH=${ROOTPATH/\/build\/scripts\/lightspeed}

if sed -i '/# sed_rag_content/,/# sed_rag_content_end/d' "${ROOTPATH}/build/ci/sync-midstream.sh"; then
    echo "RAG content removed from sync-midstream.sh job!"
else
    echo "error!"
    exit 1
fi
