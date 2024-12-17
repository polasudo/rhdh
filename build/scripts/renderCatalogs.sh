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
templateFile=""

VERSIONS="4.14 4.15 4.16 4.17 4.18"

DWNSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")
latestNextExample=""
if [[ ${DWNSTM_BRANCH} == "rhdh-"*"-rhel-"* ]]; then 
  if [[ $DWNSTM_BRANCH == "rhdh-1-rhel-9" ]]; then
    latestNextExample="--next"
  else
    latestNextExample="--latest"
  fi
fi

DO_COMMIT=1 # by default, commit change
DO_PUSH=1   # push the commit
USE_RHEC=0  # by default, don't change quay.io -> rr.io 
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
  
  --template             instead of generating a template, use some other local file
  --rhec                 switch any quay.io/rhdh/ image refs to registry.redhat.io/rhdh/ (RH Ecosystem Catalog)

  --nocommit             do not commit or push local changes
  --nopush               do not push local changes
  --clean                if catalog render folder exists on disk, delete and create a new one; also delete when done
  -h, --help             show this help

Examples:
    for v in $VERSIONS; do $0 $latestNextExample --clean -v 1.y.0 --versions \$v; echo 'Sleep 1 min to avoid Konflux tag collisions'; sleep 60s; echo; done

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
    '--template') templateFile="$2"; shift 1;;
    '--rhec') USE_RHEC="1";;
    '--versions') VERSIONS="$2"; shift 1;;
    '--clean') CLEAN=1;;
    '--nocommit') DO_COMMIT=0; DO_PUSH=0;;
    '--nopush')   DO_PUSH=0;;
    '-h'|'--help') usage;;
    *) echo "Unknown parameter used: $1."; usage;;
  esac
  shift 1
done

# check if $1 is greater than or equal to $2
vergte() {
    [  "$1" = "$(echo -e "$1\n$2" | sort -Vr | head -n1)" ]
}

PROD_VERSION=${PROD_FULL_VERSION%.*} # x.y

for v in $VERSIONS; do
  # create folder for the rendered catalog.json
  mkdir -p "catalogs/v${v}/configs/${prod_path}/"

  if [[ ! $templateFile ]] || [[ ! -f $templateFile ]]; then
    # extract content from the public registry
    if [[ ! -d ./v${v}-catalog-migrate ]] || [[ $CLEAN -eq 1 ]]; then 
      rm -fr "./v${v}-catalog-migrate"
      time opm migrate registry.redhat.io/redhat/redhat-operator-index:v${v} ./v${v}-catalog-migrate
    fi

    templateFile="catalogs/v${v}/catalog-template.json"

    # create template from the existing content
    opm alpha convert-template basic "./v${v}-catalog-migrate/${prod_path}/catalog.json" > "${templateFile}"
    # debug with # cp "${templateFile}" "${templateFile}.orig"

    # eg., for 1.4.0 want to replace 1.3.1 (last released item on the fast channel)
    PROD_PREV_VERSION=$(jq -r '.entries[]|select(.name=="fast")|.entries|last|.name' "${templateFile}")

    NEW_ENTRY='[
          {
              "name": "'"${operator_name}"'.v'"${PROD_FULL_VERSION}"'",
              "replaces": "'"${PROD_PREV_VERSION}"'",
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
      "${templateFile}" > "${templateFile}_"

    # if fast-1.y channel already exists
    if [[ $(jq --arg PROD_VERSION "${PROD_VERSION}" '.entries[]|select(.name=="fast-'"$PROD_VERSION"'")' "${templateFile}_") ]]; then
      # add new entry to existing fast-1.y channel
      JSON=$(jq --arg NEW_ENTRY "${NEW_ENTRY}" --arg PROD_VERSION "${PROD_VERSION}" \
        '.entries[]|select(.name=="fast-'"$PROD_VERSION"'")|.entries += '"$NEW_ENTRY" \
        "${templateFile}_")
      # remove old fast-1.y entry 
      jq --arg NEW_JQ "${NEW_JQ}" 'del(.entries[]|select(.name=="fast-'"$PROD_VERSION"'"))' "${templateFile}_" > "${templateFile}__"
      mv -f "${templateFile}__" "${templateFile}_"
    fi
    # inject new/updated fast-1.y channel
    jq --arg JSON "${JSON}" '.entries[.entries|length] |= . + '"$JSON" \
      "${templateFile}_" > "${templateFile}" 

    # latest CI build
    bundle_digest=$(skopeo inspect "docker://${bundle_image}:$PROD_VERSION" | jq -r '.Digest')
    echo "Got $bundle_image@$bundle_digest"
    ./build/scripts/getTagForSHA.sh "$bundle_image@$bundle_digest" -y

    # inject new bundle
    jq --arg bundle_digest "${bundle_digest}" --arg bundle_image "${bundle_image}" \
      '.entries[.entries|length] |= . +  {"schema":"olm.bundle", "image": "'"${bundle_image}"'@'"$bundle_digest"'"}' \
      "${templateFile}" > "${templateFile}_"

    # rename
    mv "${templateFile}"{_,}

    grep "quay.io/rhdh/rhdh-operator-bundle" "${templateFile}" || true
  fi

  # switch quay.io/rhdh references that will fail in a push to production Release
  if [[ $USE_RHEC -eq 1 ]]; then 
    sed -i "catalogs/v${v}/catalog-template.json" -r -e "s|quay.io/rhdh|registry.redhat.io/rhdh|g"
  fi

  # render catalog content from the template
  rm -f "catalogs/v${v}/configs/${prod_path}/catalog.json"
  # for 4.17+, migrate bundles' "olm.bundle.object" to "olm.csv.metadata"
  vergte "$v" "4.17" && migrateLevel="--migrate-level=bundle-object-to-csv-metadata" || migrateLevel=""
  set -x
  # shellcheck disable=SC2086
  opm alpha render-template basic "${templateFile}" $migrateLevel > "catalogs/v${v}/configs/${prod_path}/catalog.json"
  set +x

  # for 4.15+, use the rhel9 image
  vergte "$v" "4.15" && registry="registry-rhel9:v${v}" || registry="registry:v${v}"
  
  # temporary hackaround for v4.18 because it doesn't exist yet; fall back to 4.17
  registry=${registry/v4.18/v4.17}

  fastYChannel=""; if [[ $PROD_VERSION ]]; then fastYChannel=",fast-${PROD_VERSION}"; fi

  # if using build-image-index=false in .tekton push pipeline, append the arch to the tags (like in OSBS)
  # set to "" and re-render if switching back to build-image-index=true
  arch="-$(uname -m)"

  echo "Render catalogs/v${v}/Containerfile for channels=fast${fastYChannel}"
  latestNextTag=""; if [[ $latestNext ]]; then latestNextTag=",${latestNext}-v${v}${arch}"; fi # next=v4.18

  cat <<EOF > "catalogs/v${v}/Containerfile"
  # The base image is expected to contain /bin/opm (with a serve subcommand) and /bin/grpc_health_probe
FROM registry.redhat.io/openshift4/ose-operator-${registry}

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
      konflux.additional-tags="${PROD_VERSION}-v${v}${arch}${latestNextTag}" \\
      distribution-scope="public" \\
      url="$prod_url"
EOF

  # cleanup rendered catalogs
  if [[ -d ./v${v}-catalog-migrate ]] && [[ $CLEAN -eq 1 ]]; then 
    rm -fr "./v${v}-catalog-migrate"
  fi

  if [[ $DO_COMMIT -eq 1 ]]; then
    echo "[INFO] Commit changes to catalogs/v${v}/"
    git add -f "catalogs/v${v}/" || true
    # don't trigger gitlab pipelines [ci skip], only tekton ones
    commitMsg="renderCatalogs.sh from catalogs/v${v}/, in channel(s) fast${fastYChannel}, for ${PROD_VERSION}-v${v}${arch}${latestNextTag}; add $PROD_FULL_VERSION"
    if [[ $USE_RHEC -eq 1 ]]; then commitMsg=":: GA PUSH :: ${commitMsg}"; fi
    git commit -s -m "[ci skip] $commitMsg" "catalogs/v${v}/" || true
  fi
  if [[ ${DO_PUSH} -eq 1 ]]; then
    git pull origin "${DWNSTM_BRANCH}"
    set -x
    git push origin "${DWNSTM_BRANCH}"
    set +x
    echo
    echo "See running pipelines: https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhdh/applications/fbc-${v/./-}/activity/pipelineruns"
  fi 
done

