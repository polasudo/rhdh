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

# defaults for RHDH 1.4+
package_name="rhdh"
prod_path="rhdh" # path under configs/
prod_url="https://red.ht/rhdh"
operator_name="rhdh-operator"
bundle_image="quay.io/rhdh/rhdh-operator-bundle"
maintainers="RHDH Team <rhdh-bot@redhat.com>"

VERSIONS="4.14 4.15 4.16 4.17 4.18"

CLEAN=0
latestNext=""

usage() {
  cat <<EOF
Render an index / IIB catalog sources as file-based catalogs (FBC), and insert the latest CI build for a given product version

Requires:
* opm 1.47 (see https://github.com/operator-framework/operator-registry/releases/tag/v1.47.0 )

Usage: $0 -v x.y.z [OPTIONS]

Options:
  -v                     product version x.y.z,                                        eg., 1.4.0
  --latest, --next       also publish a :latest-v4.yy or :next-v4.yy tag; default: publish only x.y-v4.yy tag

  --package-name         olm package name,                                             eg., rhdh
  --prod-path            path under configs/<prod-path>/,                              eg., rhdh
  --prod-url             url to use as LABEL url=... in Containerfile,                 eg., https://red.ht/rhdh
  --operator-name        could be the same as your olm package or end with -operator,  eg., rhdh-operator
  --bundle-image         operator bundle image to add to the catalog,                  eg., quay.io/rhdh/rhdh-operator-bundle
  --maintainers          one or more comma-separated email addresses,                  eg., RHDH Team <rhdh-bot@redhat.com>

  --versions             space-separated list of OCP versions to render;               
                         default: $VERSIONS

  --clean                if catalog render folder exists on disk, delete and create a new one; also delete when done
  -h, --help             show this help

Examples:
    $0 --clean --versions "$VERSIONS" -v 1.4.0

EOF
exit
}

if [[ $# -lt 1 ]]; then usage; fi

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-v') PROD_FULL_VERSION="$2"; shift 1;; # x.y.z
    '--latest'|'--next') latestNext="${1/--/}";;
    '--package-name') package_name="$2"; shift 1;; 
    '--prod-path') prod_path="$2"; shift 1;; 
    '--prod-url') prod_url="$2"; shift 1;; 
    '--operator-name') operator_name="$2"; shift 1;; 
    '--bundle-image') bundle_image="$2"; shift 1;; 
    '--maintainers') maintainers="$2"; shift 1;; 
    '--versions') VERSIONS="$2"; shift 1;;
    '--clean') CLEAN=1;;
    '-h'|'--help') usage;;
    *) echo "Unknown parameter used: $1."; usage;;
  esac
  shift 1
done

PROD_VERSION=${PROD_FULL_VERSION%.*} # x.y
if [[ $PROD_FULL_VERSION =~ ^([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then
  XX=${BASH_REMATCH[1]}
  YY=${BASH_REMATCH[2]}; (( YY = YY - 1 ))
fi
PROD_PREV_VERSION="${XX}.${YY}.0"

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
  mkdir -p "catalogs/v${v}/configs/${prod_path}/"
  # create template from the existing content
  opm alpha convert-template basic "./v${v}-catalog-migrate/${prod_path}/catalog.json" > "catalogs/v${v}/catalog-template.json"

  NEW_ENTRY='[
        {
            "name": "'"${operator_name}"'.v'"${PROD_FULL_VERSION}"'",
            "replaces": "'"${operator_name}"'.v'"${PROD_PREV_VERSION}"'",
            "skipRange": "\u003c'"${PROD_FULL_VERSION}"'"
        }
    ]'

  JSON='
  {
    "entries": '"${NEW_ENTRY}"',
    "name": "fast-'"${PROD_VERSION}"'",
    "package": "'"${package_name}"'",
    "schema": "olm.channel"
  }'

  # inject new entry into default channel
  jq --arg NEW_ENTRY "${NEW_ENTRY}" \
    '.entries[1].entries += '"$NEW_ENTRY" \
    "catalogs/v${v}/catalog-template.json" > "catalogs/v${v}/catalog-template.json_"

  # inject new fast-1.y channel
  jq --arg JSON "${JSON}" '.entries[.entries|length] |= . + '"$JSON" \
    "catalogs/v${v}/catalog-template.json_" > "catalogs/v${v}/catalog-template.json" 

  # latest CI build
  bundle_digest=$(skopeo inspect "docker://${bundle_image}:$PROD_VERSION" | jq -r '.Digest')

  # inject new bundle
  jq --arg bundle_digest "${bundle_digest}" --arg bundle_image "${bundle_image}" \
    '.entries[.entries|length] |= . +  {"schema":"olm.bundle", "image": "'"${bundle_image}"'@'"$bundle_digest"'"}' \
    "catalogs/v${v}/catalog-template.json" > "catalogs/v${v}/catalog-template.json_"

  # rename
  mv "catalogs/v${v}/catalog-template.json"{_,}

  # render catalog content from the template
  opm alpha render-template basic catalogs/v${v}/catalog-template.json > catalogs/v${v}/configs/${prod_path}/catalog.json

  # for 4.15+, use the rhel9 image
  vergte "$v" "4.15" && registry="registry-rhel9" || registry="registry"

  fastYChannel=""; if [[ $PROD_VERSION ]]; then fastYChannel=",fast-${PROD_VERSION}"; fi

  echo "Render catalogs/v${v}/Containerfile for channels=fast${fastYChannel}"
  latestNextTag=""; if [[ $latestNext ]]; then latestNextTag=",${latestNext}-v${v}"; fi # next=v4.18
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
LABEL operators.operatorframework.io.bundle.package.v1=${operator_name}
LABEL operators.operatorframework.io.bundle.channels.v1=fast${fastYChannel}
LABEL operators.operatorframework.io.metrics.builder=operator-sdk-v1.33.1
LABEL operators.operatorframework.io.metrics.mediatype.v1=metrics+v1
LABEL operators.operatorframework.io.metrics.project_layout=go.kubebuilder.io/v3
LABEL operators.operatorframework.io.index.configs.v1=/configs
LABEL \\
      version="${PROD_VERSION}" \\
      license="ASLv2" \\
      maintainer="$maintainers" \\
      vendor="Red Hat, Inc." \\
      konflux.additional-tags="${PROD_VERSION}-v${v}${latestNextTag}" \\
      distribution-scope="public" \\
      url="$prod_url"
EOF

  # cleanup rendered catalogs
  if [[ -d ./v${v}-catalog-migrate ]] && [[ $CLEAN -eq 1 ]]; then 
    rm -fr "./v${v}-catalog-migrate"
  fi

done

