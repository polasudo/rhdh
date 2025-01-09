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
templateFileInput=""

RHDH_VERSION="1.5.0"
OCP_VERSIONS="4.14 4.15 4.16 4.17"

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
  -v                     product version x.y.z,                                        eg., $RHDH_VERSION
  --latest, --next       also publish a :latest-v4.yy or :next-v4.yy tag; default: publish only x.y-v4.yy tag

  --package-name         olm package name,                                             eg., rhdh
  --prod-path            path under configs/<prod-path>/,                              eg., rhdh
  --prod-url             url to use as LABEL url=... in Containerfile,                 eg., https://red.ht/rhdh
  --operator-name        could be the same as your olm package or end with -operator,  eg., rhdh-operator
  --bundle-image         operator bundle image to add to the catalog,                  eg., quay.io/rhdh/rhdh-operator-bundle
  --maintainers          one or more comma-separated email addresses,                  eg., RHDH Team <rhdh-bot@redhat.com>

  --versions             space-separated list of OCP versions to render;               
                         default: $OCP_VERSIONS
  
  --template             instead of generating a template, use some other local file
  --rhec                 switch any quay.io/rhdh/ image refs to registry.redhat.io/rhdh/ (RH Ecosystem Catalog)

  --nocommit             do not commit or push local changes
  --nopush               do not push local changes
  --clean                if catalog render folder exists on disk, delete and create a new one; also delete when done
  -h, --help             show this help

Examples:
    RHDH_VERSION="$RHDH_VERSION"; \\
    for OCP_VERSION in $OCP_VERSIONS; do \\
      $0 $latestNextExample --clean --versions "\${OCP_VERSION}" -v "\${RHDH_VERSION}"; \\
      echo 'Sleep 1 min to avoid tag collisions (KONFLUX-5865)'; sleep 60s; echo; \\
    done
    # until 4.18 is live, copy the catalog from 4.17
    cp -f catalogs/v4.{17,18}/catalog-template.json
    $0 $latestNextExample --clean --versions "\${OCP_VERSION}" -v "\${RHDH_VERSION}" --template catalogs/v4.18/catalog-template.json
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
    '--template') templateFileInput="$2"; shift 1;;
    '--rhec') USE_RHEC="1";;
    '--versions') OCP_VERSIONS="$2"; shift 1;;
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

for OCP_VERSION in ${OCP_VERSIONS}; do
  # create folder for the rendered catalog.json
  mkdir -p "catalogs/v${OCP_VERSION}/configs/${prod_path}/"

  if [[ ! $templateFileInput ]] || [[ ! -f $templateFileInput ]]; then
    # extract content from the public registry
    if [[ ! -d ./v${OCP_VERSION}-catalog-migrate ]] || [[ $CLEAN -eq 1 ]]; then 
      rm -fr "./v${OCP_VERSION}-catalog-migrate"
      time opm migrate registry.redhat.io/redhat/redhat-operator-index:v${OCP_VERSION} ./v${OCP_VERSION}-catalog-migrate
    fi

    templateFile="catalogs/v${OCP_VERSION}/catalog-template.json"

    # create template from the existing content
    opm alpha convert-template basic "./v${OCP_VERSION}-catalog-migrate/${prod_path}/catalog.json" > "${templateFile}"
    # debug with # cp "${templateFile}" "${templateFile}.orig"

    # eg., for 1.4.0 want to replace 1.3.1 (last released item on the fast channel)
    PROD_PREV_VERSION=$(jq -r '.entries[]|select(.name=="fast")|.entries|last|.name' "${templateFile}")

    NEW_ENTRY='[{
          "name": "'"${operator_name}"'.v'"${PROD_FULL_VERSION}"'",
          "replaces": "'"${PROD_PREV_VERSION}"'",
          "skipRange": "\u003c'"${PROD_FULL_VERSION}"'"
    }]'

    JSON='{
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
    ./build/scripts/getTagForSHA.sh "$bundle_image@$bundle_digest" -y -q

    # inject new bundle
    jq --arg bundle_digest "${bundle_digest}" --arg bundle_image "${bundle_image}" \
      '.entries[.entries|length] |= . +  {"schema":"olm.bundle", "image": "'"${bundle_image}"'@'"$bundle_digest"'"}' \
      "${templateFile}" > "${templateFile}_"

    # rename
    mv "${templateFile}"{_,}

    grep "quay.io/rhdh/rhdh-operator-bundle" "${templateFile}" || true
  else
    templateFile="${templateFileInput}"
  fi

  # switch quay.io/rhdh references that will fail in a push to production Release
  if [[ $USE_RHEC -eq 1 ]]; then 
    sed -i "catalogs/v${OCP_VERSION}/catalog-template.json" -r -e "s|quay.io/rhdh|registry.redhat.io/rhdh|g"
  fi

  # render catalog content from the template
  rm -f "catalogs/v${OCP_VERSION}/configs/${prod_path}/catalog.json"
  # for 4.17+, migrate bundles' "olm.bundle.object" to "olm.csv.metadata"
  vergte "${OCP_VERSION}" "4.17" && migrateLevel="--migrate-level=bundle-object-to-csv-metadata" || migrateLevel=""
  set -x
  # shellcheck disable=SC2086
  opm alpha render-template basic "${templateFile}" $migrateLevel > "catalogs/v${OCP_VERSION}/configs/${prod_path}/catalog.json"
  set +x

  # for 4.15+, use the rhel9 image
  vergte "${OCP_VERSION}" "4.15" && registry="registry-rhel9:v${OCP_VERSION}" || registry="registry:v${OCP_VERSION}"
  
  # temporary hackaround for v4.18 because it doesn't exist yet; fall back to 4.17
  registry=${registry/v4.18/v4.17}

  fastYChannel=""; if [[ $PROD_VERSION ]]; then fastYChannel=",fast-${PROD_VERSION}"; fi

  # if using build-image-index=false in .tekton push pipeline, append the arch to the tags (like in OSBS)
  # set to "" and re-render if switching back to build-image-index=true
  arch="-$(uname -m)"

  # echo "[INFO] Render catalogs/v${OCP_VERSION}/Containerfile for channels=fast${fastYChannel}"
  latestNextTag=""; if [[ $latestNext ]]; then latestNextTag=",${latestNext}-v${OCP_VERSION}${arch}"; fi

  cat <<EOF > "catalogs/v${OCP_VERSION}/Containerfile"
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
      konflux.additional-tags="${PROD_VERSION}-v${OCP_VERSION}${arch}${latestNextTag}" \\
      distribution-scope="public" \\
      url="$prod_url"
EOF

  # cleanup rendered catalogs
  if [[ -d ./v${OCP_VERSION}-catalog-migrate ]] && [[ $CLEAN -eq 1 ]]; then 
    rm -fr "./v${OCP_VERSION}-catalog-migrate"
  fi

  if [[ $DO_COMMIT -eq 1 ]]; then
    # echo "[INFO] Commit changes to catalogs/v${OCP_VERSION}/"
    git add -f "catalogs/v${OCP_VERSION}/" build/scripts/renderCatalogs.sh || true
    # don't trigger gitlab pipelines [ci skip], only tekton ones
    commitMsg="renderCatalogs.sh from catalogs/v${OCP_VERSION}/, in channel(s) fast${fastYChannel}, for ${PROD_VERSION}-v${OCP_VERSION}${arch}${latestNextTag}; add $PROD_FULL_VERSION"
    if [[ $USE_RHEC -eq 1 ]]; then commitMsg=":: GA PUSH :: ${commitMsg}"; fi
    git commit -s -m "[ci skip] $commitMsg" "catalogs/v${OCP_VERSION}/" build/scripts/renderCatalogs.sh || true
  fi
  if [[ ${DO_PUSH} -eq 1 ]]; then
    git pull origin "${DWNSTM_BRANCH}" >/dev/null 2>&1 || true
    git push origin "${DWNSTM_BRANCH}" >/dev/null 2>&1
    echo
    oc -n rhdh-tenant get Snapshots --sort-by=.metadata.creationTimestamp --selector='pac.test.appstudio.openshift.io/original-prname=fbc-'"${OCP_VERSION/./-}"'-on-push' -o yaml > "/tmp/fbc-snapshots-${OCP_VERSION}.yaml"
    # debugging
    echo "Found these snapshots:"
    echo -e "timestamp\tsnapshot\tpipelinerun\t\tmidstreamCommitSHA"
    yq -r '.items[]|select(.metadata.annotations."pac.test.appstudio.openshift.io/branch" == "'"${DWNSTM_BRANCH}"'")|.metadata.labels."test.appstudio.openshift.io/pipelinerunfinishtime" + "\t" + .metadata.labels."appstudio.openshift.io/build-pipelinerun" + "\t" + .metadata.labels."pac.test.appstudio.openshift.io/sha" + "\t" + .metadata.labels."pac.test.appstudio.openshift.io/state"' "/tmp/fbc-snapshots-${OCP_VERSION}.yaml" | tail -3
    # 1734476600	fbc-4-14-on-push-f2svf	88f44169d0eafe2af2e9ea23e7897299b2cd392f	completed
    # 1734722108	fbc-4-14-on-push-tb9m9	3370ba7ca6f0f9dfb5acff899066a29443467a65	completed

    # choose the latest run
    # TODO select only if in progress, not complete
    pipelinerun=$(yq -r '.items[]|select(.metadata.annotations."pac.test.appstudio.openshift.io/branch" == "'"${DWNSTM_BRANCH}"'")|.metadata.labels."appstudio.openshift.io/build-pipelinerun"' "/tmp/fbc-snapshots-${OCP_VERSION}.yaml" | tail -1)
    if [[ $pipelinerun ]]; then
      PIPELINE_URL="https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhdh/applications/fbc-${OCP_VERSION/./-}/pipelineruns/${pipelinerun}/taskruns"
      echo "Running in $PIPELINE_URL"
    else
      PIPELINE_URL="https://konflux.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/application-pipeline/workspaces/rhdh/applications/fbc-${OCP_VERSION/./-}/activity/pipelineruns"
      echo "Pipelinerun not found for branch = $DWNSTM_BRANCH - see running pipelineruns at $PIPELINE_URL"
    fi
    # open a browser to watch the release
    if [[ $(command -v google-chrome) == *"google-chrome"* ]] || [[ $(which google-chrome) != *"which: no google-chrome"* ]]; then google-chrome "$PIPELINE_URL"; fi
    echo "-----------------------------------------------------------------------"
    echo
    rm -f "/tmp/fbc-snapshots-${OCP_VERSION}.yaml"
  fi 
done

