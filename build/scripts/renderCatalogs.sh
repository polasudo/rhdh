#!/bin/bash -e
#
# Copyright (c) 2024 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#

# render IIB catalog sources as FBCs for use with Konflux Tekton pipelines

CLEAN=0
VERSIONS="4.14 4.15 4.16 4.17 4.18"
usage() {
  cat <<EOF
Render IIB catalog sources as file-based catalogs (FBC)

Requires:
* opm 1.47 (see https://github.com/operator-framework/operator-registry/releases/tag/v1.47.0 )

Usage: $0 [OPTIONS]

Options:
  -v                     RHDH version 1.y for 'fast-1.y' channel; default: only use 'fast' channel
  --versions             space-separated list of OCP versions to render; default: $VERSIONS
  --clean                if existing catalog render on disk, delete and create a new one; delete when done
  -h, --help             show this help

Examples:
    $0 --clean --versions "$VERSIONS" -v 1.4

EOF
exit
}

if [[ $# -lt 1 ]]; then usage; fi

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-v') RHDH_VERSION="$2"; shift 1;;
    '--versions') VERSIONS="$2"; shift 1;;
    '--clean') CLEAN=1;;
    '-h'|'--help') usage;;
    *) echo "Unknown parameter used: $1."; usage;;
  esac
  shift 1
done

# check if $1 is greater than or equal to $2
vergte() {
    [  "$1" = "$(echo -e "$1\n$2" | sort -Vr | head -n1)" ]
}

for v in $VERSIONS; do
  # extract content from the public registry
  if [[ ! -d ./v${v}-catalog-migrate ]] || [[ $CLEAN -eq 1 ]]; then 
    rm -fr "./v${v}-catalog-migrate"
    time opm migrate registry.redhat.io/redhat/redhat-operator-index:v${v} ./v${v}-catalog-migrate
  fi
  # create folder for the rendered catalog.json
  mkdir -p catalogs/v${v}/configs/rhdh/
  # create template from the existing content
  opm alpha convert-template basic ./v${v}-catalog-migrate/rhdh/catalog.json > catalogs/v${v}/catalog-template.json
  # render catalog content from the template
  opm alpha render-template basic catalogs/v${v}/catalog-template.json > catalogs/v${v}/configs/rhdh/catalog.json

  # for 4.15+, use the rhel9 image
  vergte "$v" "4.15" && registry="registry-rhel9" || registry="registry"

  fastYChannel=""; if [[ $RHDH_VERSION ]]; then fastYChannel=",fast-${RHDH_VERSION}"; fi

  echo "Render catalogs/v${v}/Containerfile for channels=fast${fastYChannel}"
  cat <<EOF > "catalogs/v${v}/Containerfile"
  # The base image is expected to contain /bin/opm (with a serve subcommand) and /bin/grpc_health_probe
FROM registry.redhat.io/openshift4/ose-operator-${registry}:v${v}

ENTRYPOINT ["/bin/opm"]
CMD ["serve", "/configs", "--cache-dir=/tmp/cache"]

COPY configs /configs

RUN ["/bin/opm", "serve", "/configs", "--cache-dir=/tmp/cache", "--cache-only"]

# Core bundle labels.

LABEL operators.operatorframework.io.bundle.mediatype.v1=registry+v1
LABEL operators.operatorframework.io.bundle.manifests.v1=manifests/
LABEL operators.operatorframework.io.bundle.metadata.v1=metadata/
LABEL operators.operatorframework.io.bundle.package.v1=rhdh-operator
LABEL operators.operatorframework.io.bundle.channels.v1=fast${fastYChannel}
LABEL operators.operatorframework.io.metrics.builder=operator-sdk-v1.33.1
LABEL operators.operatorframework.io.metrics.mediatype.v1=metrics+v1
LABEL operators.operatorframework.io.metrics.project_layout=go.kubebuilder.io/v3
LABEL operators.operatorframework.io.index.configs.v1=/configs
LABEL \\
      version="${RHDH_VERSION}" \\
      license="ASLv2" \\
      maintainer="RHDH Team <rhdh-bot@redhat.com>" \\
      vendor="Red Hat, Inc." \\
      konflux.additional-tags="${RHDH_VERSION}-v${v}-$(uname -m)" \\
      distribution-scope="public" \\
      url="https://red.ht/rhdh"
EOF

  # cleanup rendered catalogs
  if [[ -d ./v${v}-catalog-migrate ]] && [[ $CLEAN -eq 1 ]]; then 
    rm -fr "./v${v}-catalog-migrate"
  fi

done

