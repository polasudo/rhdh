#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
#
# injects product metadata into RHDH RAG content build scripts

# error if the required arguments are not met
if [ $# -ne 3 ]; then
    echo "expected three arguments: $0 <upstream_repo_rag> <midstream_repo> <latest_next_tag>"
    exit 1
fi

upstream_repo_rag="$1"
midstream_repo="$2"
latest_next_tag="$3"

SCRIPT=$(readlink -f "$0")
ROOTPATH=$(dirname "$SCRIPT"); ROOTPATH=${ROOTPATH/\/build\/scripts\/lightspeed}

# error if required locations do not exist
if [ ! -d ${ROOTPATH}/distgit/containers/rhdh-hub ] || [ ! -d ${ROOTPATH}/distgit/containers/rhdh-rag-content ]; then
    echo "expected '${ROOTPATH}/distgit/containers/rhdh-hub' and '${ROOTPATH}/distgit/containers/rhdh-rag-content' paths to exist"
    exit 1
fi

# get RHDH and base Backstage versions from rhdh-hub component
RHDH_VERSION=$(grep '"RHDH Version"' "${ROOTPATH}/distgit/containers/rhdh-hub/packages/app/src/build-metadata.json" | sed 's/.*": "\([^"]*\)".*/\1/') && \
BACKSTAGE_VERSION=$(grep '"Backstage Version"' "${ROOTPATH}/distgit/containers/rhdh-hub/packages/app/src/build-metadata.json" | sed 's/.*": "\([^"]*\)".*/\1/') 

TMPDIR=/tmp

# append Brew metadata here
# set -x
for c in ${ROOTPATH}/distgit/containers/rhdh-rag-content/Dockerfile.in ${ROOTPATH}/distgit/containers/rhdh-rag-content/Containerfile; do
if [[ -f $c ]]; then sed -i '/# append Brew metadata here/q' $c; fi
done
# set +x
cat <<EOT >$TMPDIR/rag-content.Dockerfile.foot

ENV SUMMARY="Red Hat Developer Hub RAG content" \\
DESCRIPTION="Red Hat Developer Hub RAG content" \\
RHDH_VERSION="${RHDH_VERSION}" \\
BACKSTAGE_VERSION="${BACKSTAGE_VERSION}" \\
UPSTREAM_REPO="${upstream_repo_rag}" \\
MIDSTREAM_REPO="${midstream_repo}" \\
PRODNAME="rhdh" \\
COMPNAME="rag-content"

LABEL summary="\$SUMMARY" \\
    description="\$DESCRIPTION" \\
    io.k8s.description="\$DESCRIPTION" \\
    io.k8s.display-name="\$DESCRIPTION" \\
    io.openshift.tags="\$PRODNAME,\$COMPNAME" \\
    com.redhat.component="\$PRODNAME-\$COMPNAME-container" \\
    name="\$PRODNAME/\$PRODNAME-rhel9-\$COMPNAME" \\
    version="\${CI_X_VERSION}.\${CI_Y_VERSION}" \\
    release="\${RELEASE_NUMBER}" \\
    license="ASLv2" \\
    maintainer="RHDH Team <rhdh-bot@redhat.com>" \\
    vendor="Red Hat, Inc." \\
    io.openshift.expose-services="" \\
    usage="" \\
    konflux.additional-tags="${latest_next_tag}\${CI_X_VERSION}.\${CI_Y_VERSION}, \${CI_X_VERSION}.\${CI_Y_VERSION}-\${RELEASE_NUMBER}" \\
    distribution-scope="public" \\
    url="https://red.ht/rhdh" \\
    cpe="cpe:/a:redhat:rhdh:\${CI_X_VERSION}.\${CI_Y_VERSION}::el9"
EOT
echo "[INFO] Added metadata to $TMPDIR/rag-content.Dockerfile.foot"
