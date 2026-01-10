#!/usr/bin/env bash
#
# Copyright (c) 2024 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#

# render IIB catalog sources as FBCs for use with Konflux Tekton pipelines

set -e 

# defaults for RHDH 1.4+
package_name="rhdh"
prod_path="rhdh" # path under configs/
prod_url="https://red.ht/rhdh"
operator_name="rhdh-operator"
bundle_image="quay.io/rhdh/rhdh-operator-bundle"
maintainers="RHDH Team <rhdh-bot@redhat.com>"
templateFileInput=""

# shortcut to running the recommended for loop
DO_DEFAULT=0
DRYRUN=""
# assume running locally; if --ci flag used, then don't try to log in to the konlfux console to retrieve pipelinerun information
CI=""

# eg., rhdh-1.5-rhel-9
latestStableBranch="$(curl -sSLk --url "https://gitlab.cee.redhat.com/api/v4/projects/rhidp%2Frhdh/repository/branches?per_page=200&regex=^rhdh-1..*-rhel-9$" | jq -r '.[].name' | sort -uV | tail -1)"; # echo $latestStableBranch

DWNSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")
latestNextExample=""
if [[ ${DWNSTM_BRANCH} == "rhdh-"*"-rhel-"* ]]; then 
  if [[ $DWNSTM_BRANCH == "rhdh-1-rhel-9" ]]; then
    latestNextExample="--next"
  elif [[ "$DWNSTM_BRANCH" == "${latestStableBranch}" ]]; then # latest stable branch
    latestNextExample="--latest"
  fi
fi

norm="\033[0;39m"
green="\033[1;32m"
blue="\033[1;34m"
red="\033[1;31m"

SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)
ROOTPATH=$(cd "$SCRIPT_DIR"/../../ || exit; pwd)

if [[ -f ${ROOTPATH}/distgit/containers/rhdh-hub/package.json ]]; then
  RHDH_VERSION="$(jq -r '.version' "${ROOTPATH}/distgit/containers/rhdh-hub/package.json")"
else
  RHDH_VERSION="1.y.z"
fi

# Load OCP version configuration from YAML file
CONFIG_FILE="$SCRIPT_DIR/ocp-versions.yaml"
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "OCP versions file not found: $CONFIG_FILE"
    exit 1
fi

# Parse YAML configuration
OCP_VERSION_BASE=$(yq -r '.OCP_VERSION_BASE' "$CONFIG_FILE")
OCP_VERSION_NEXT=$(yq -r '.OCP_VERSION_NEXT' "$CONFIG_FILE")
OCP_SUPPORTED_VERSIONS=$(yq -r '.SUPPORTED_VERSIONS[]' "$CONFIG_FILE" | paste -sd ' ')
# render all supported versions by default
OCP_VERSIONS="$OCP_VERSION_BASE $OCP_SUPPORTED_VERSIONS $OCP_VERSION_NEXT"

RHEL9_REGISTRY=$(yq -r '.REGISTRIES.RHEL9_REGISTRY' "$CONFIG_FILE")
BREW_REGISTRY=$(yq -r '.REGISTRIES.BREW_REGISTRY' "$CONFIG_FILE")

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
* a logged in oc session with your Konflux cluster, eg., from https://console-openshift-console.apps.<your-cluster-here>.openshiftapps.com/k8s/cluster/projects/rhdh-tenant

Usage: $0 -v x.y.z [OPTIONS]

Options:
  -v                     product version x.y.z,                                        eg., $RHDH_VERSION
  --latest, --next       also publish a :latest-v4.yy or :next-v4.yy tag; default: publish only x.y-v4.yy tag

  --package-name         olm package name,                                                             eg., rhdh
  --prod-path            path under configs/<prod-path>/,                                              eg., rhdh
  --prod-url             url to use as LABEL url=... in Containerfile,                                 eg., https://red.ht/rhdh
  --operator-name        could be the same as your olm package or end with -operator,                  eg., rhdh-operator
  --bundle-image         operator bundle image to add to the catalog,                                  eg., quay.io/rhdh/rhdh-operator-bundle
  --maintainers          one or more comma-separated email addresses,                                  eg., RHDH Team <rhdh-bot@redhat.com>

  --versions             space-separated list of OCP versions to render;
                         default: $OCP_VERSIONS

  --template             instead of generating a template, use some other local file
  --rhec                 switch any quay.io/rhdh/ image refs to registry.redhat.io/rhdh/ (RH Ecosystem Catalog)

  --nocommit             do not commit or push local changes
  --nopush               do not push local changes
  --clean                if catalog render folder exists on disk, delete and create a new one; also delete when done
  --default              run the example below
  --dryrun               show commands to run but do not execute them
  --ci                   run in CI mode -- do not attempt to log in to the Konflux UI to track pipelineruns
  -h, --help             show this help

Examples:
    oc login --token=<your-token-here> --server=https://api.<your-cluster-here>.openshiftapps.com:6443

    # If all your templates are the same - that is, the same versions of operator-bundles exist on all OCP versions),
    # you can render one template from the public index, and then copy it for the other OCP versions. 

    # same as: $0 --default
    $0 $latestNextExample --clean --versions "${OCP_VERSION_BASE}" -v "${RHDH_VERSION}"
    alias cp=cp
    for OCP_VERSION in ${OCP_SUPPORTED_VERSIONS% } $OCP_VERSION_NEXT; do \\
      sleep 30s; \\
      cp -f catalogs/v{$OCP_VERSION_BASE,\$OCP_VERSION}/catalog-template.json; \\
      $0 $latestNextExample --clean --versions "\${OCP_VERSION}" -v "${RHDH_VERSION}" --template "catalogs/v\${OCP_VERSION}/catalog-template.json"; \\
    done
EOF
}

# check if $1 is greater than or equal to $2
vergte() {
    [  "$1" = "$(echo -e "$1\n$2" | sort -Vr | head -n1)" ]
}

function openURL {
    if [[ $(command -v google-chrome) == *"google-chrome"* ]] || [[ $(which google-chrome 2>&1) != *"which: no google-chrome"* ]]; then 
        google-chrome "$1" >/dev/null 2>&1
    else 
        echo " >> $1"
    fi
}

if [[ $# -lt 1 ]]; then usage; exit 1; fi

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
    '--default')             DO_DEFAULT=1;;
    '--dryrun')              DRYRUN="$1";;
    '--ci')                  CI="$1";;
    '-h'|'--help') usage; exit 0;;
    *) usage; echo; echo -e "\n${red}[ERROR] Unknown parameter used: $1 ${norm}"; exit 1;;
  esac
  shift 1
done

if [[ $CI_BUILDS_DIR ]]; then # running in gitlab so set up env
  echo -e "${blue}[INFO] Running in gitlab pipeline. ${norm}"
  # shellcheck disable=SC1091
  source "${ROOTPATH}/build/ci/gitlab-ci-env-setup.sh"
  CI="--ci"
fi

if [[ $CI == "" ]]; then # not in CI mode
  # break if not logged in
  if [[ $(oc whoami 2>&1 || true) == *"You must be logged in"* ]] || [[ $(oc whoami 2>&1 || true) == *"cannot get resource"* ]]; then 
    usage; echo; echo -e "${red}[ERROR] You must be logged into the konflux console at https://console-openshift-console.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/k8s/cluster/projects/rhdh-tenant !${norm}"; echo; exit 1; 
  else
    oc project rhdh-tenant >/dev/null 2>&1 || { usage; echo; echo -e "${red}[ERROR] You must have access to the rhdh-tenant namespace! Are you logged in at https://console-openshift-console.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/k8s/cluster/projects/rhdh-tenant ?${norm}"; echo; exit 1; }
    oc -n rhdh-tenant get PipelineRuns >/dev/null 2>&1 || { usage; echo; echo -e "${red}[ERROR] Cannot load PipelineRuns from rhdh-tenant namespace. Are you logged into the correct konflux console at https://console-openshift-console.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/k8s/cluster/projects/rhdh-tenant ?${norm}"; echo; exit 1; }
  fi
else
  echo -e "${blue}[INFO] Running in CI mode (--ci). ${norm}"
fi

recurse () {

  RHEC_FLAG=""
  if [[ $USE_RHEC == "1" ]]; then RHEC_FLAG="--rhec"; fi

  echo -e "\n${blue} >> $0 $latestNextExample --clean --versions ${OCP_VERSION_BASE} -v ${RHDH_VERSION} $RHEC_FLAG $DRYRUN $CI${norm}\n"
  if [[ ! $DRYRUN ]]; then 
    # shellcheck disable=SC2086
    $0 $latestNextExample --clean --versions "${OCP_VERSION_BASE}" -v "${RHDH_VERSION}" $RHEC_FLAG $DRYRUN $CI
  fi
  for OCP_VERSION in ${OCP_VERSIONS//${OCP_VERSION_BASE} }; do \
    if [[ ! $DRYRUN ]]; then 
      sleep 30s
    fi
    if [[ ! -d "catalogs/v$OCP_VERSION/" ]]; then # need to bootstrap from scratch
      echo -e "\n${blue} >> $0 $latestNextExample --clean --versions ${OCP_VERSION} -v ${RHDH_VERSION} $RHEC_FLAG $DRYRUN $CI${norm}\n"
      if [[ ! $DRYRUN ]]; then 
        # shellcheck disable=SC2086
        $0 $latestNextExample --clean --versions "${OCP_VERSION}" -v "${RHDH_VERSION}" $RHEC_FLAG $DRYRUN $CI
      fi
    else # folder exists so just run from template
      cp -f "catalogs/v$OCP_VERSION_BASE/catalog-template.json" "catalogs/v$OCP_VERSION/catalog-template.json"
      echo -e "\n${blue} >> $0 $latestNextExample --clean --versions ${OCP_VERSION} -v ${RHDH_VERSION} --template catalogs/v${OCP_VERSION}/catalog-template.json $RHEC_FLAG $DRYRUN $CI${norm}\n"
      if [[ ! $DRYRUN ]]; then 
        # shellcheck disable=SC2086
        $0 $latestNextExample --clean --versions "${OCP_VERSION}" -v "${RHDH_VERSION}" --template "catalogs/v${OCP_VERSION}/catalog-template.json" $RHEC_FLAG $DRYRUN $CI 
      fi
    fi
  done
}

if [[ $DO_DEFAULT -eq 1 ]]; then
  recurse; exit 0
else
  if [[ $PROD_FULL_VERSION == "" ]] || [[ $OCP_VERSIONS == "" ]]; then 
    usage; echo; echo -e "${red}[ERROR] product and OCP versions not set with -v $PROD_FULL_VERSION --versions '$OCP_VERSION_BASE $OCP_VERSIONS' ! ${norm}"; exit 1
  fi
fi

# break if opm 1.47.0 or newer not installed
opmversion=$(opm version | sed -r -e "s@.+OpmVersion:\"([0-9a-fv.]+)\".+@\1@" | tr -d "v")
if [[ $opmversion != *"."* ]]; then echo -e "\n${red}[ERROR] OPM version $opmversion is too old. You must install opm v1.47.0 or newer from https://github.com/operator-framework/operator-registry/releases/tag/v1.47.0 to continue.${norm}\n"; usage; exit 1; fi
if vergte "${opmversion}" "1.47.0"; then
  # echo "opm version $opmversion found"
  true
else
  echo -e "\n${red}[ERROR] OPM version $opmversion is too old. You must install opm 1.47.0 or newer from https://github.com/operator-framework/operator-registry/releases/tag/v1.47.0 to continue.${norm}\n"; usage; exit 1
fi

if [[ $templateFileInput ]] && [[ ! -f $templateFileInput ]]; then
  echo -e "${red}[ERROR] Could not find template file $templateFileInput !${norm}"; echo; usage; exit 1
fi

PROD_VERSION=${PROD_FULL_VERSION%.*} # x.y
CATALOGS=(catalogs)

for OCP_VERSION in ${OCP_VERSIONS}; do
  for CATALOG_DIR in "${CATALOGS[@]}"; do
    echo "[INFO] Render catalog from file ${CATALOG_DIR}, openshift version: ${OCP_VERSION}"

    # create folder for the rendered catalog.json
    mkdir -p "${CATALOG_DIR}/v${OCP_VERSION}/configs/${prod_path}/"

    if [[ ! $templateFileInput ]] || [[ ! -f $templateFileInput ]]; then
      # extract content from the public registry
      if [[ ! -d ./v${OCP_VERSION}-catalog-migrate ]] || [[ $CLEAN -eq 1 ]]; then 
        rm -fr "./v${OCP_VERSION}-catalog-migrate"
        time opm migrate registry.redhat.io/redhat/redhat-operator-index:v${OCP_VERSION} ./v${OCP_VERSION}-catalog-migrate
      fi

      templateFile="${CATALOG_DIR}/v${OCP_VERSION}/catalog-template.json"

      # create template from the existing content
      opm alpha convert-template basic "./v${OCP_VERSION}-catalog-migrate/${prod_path}/catalog.json" > "${templateFile}"
      # debug with # cp "${templateFile}" "${templateFile}.orig"

      # eg., for 1.4.0 want to replace 1.3.1 (last released item on the fast channel)
      # but for 1.3.4, want to replace 1.3.3 (not 1.4.0) so filter by PROD_VERSION
      PROD_PREV_VERSION=$(jq -r '.entries[]|select(.name=="fast")|.entries[]|select(.name|contains("'"$PROD_VERSION"'"))|.name' "${templateFile}" | tail -1)
      echo -e "${blue}[DEBUG] Got last PROD_PREV_VERSION of $PROD_VERSION in fast channel = ${PROD_PREV_VERSION}${norm}" # last released 1.3.z version in fast channel = 1.3.3
      if [[ $PROD_PREV_VERSION ]] && [[ $PROD_PREV_VERSION != "null" ]]; then 
        # update "replaces": "rhdh-operator.v1.3.3" ==> "replaces": "rhdh-operator.v1.3.4"
        sed -r -e 's@"replaces": "'"$PROD_PREV_VERSION"'"@"replaces": "'"${operator_name}"'.v'"${PROD_FULL_VERSION}"'"@' -i "${templateFile}"
      else
        PROD_LAST_VERSION=$(jq -r '.entries[]|select(.name=="fast")|.entries[].name' "${templateFile}" | sort -uV | tail -1)
        echo -e "${blue}[DEBUG] Got last PROD_LAST_VERSION in fast channel = ${PROD_LAST_VERSION}${norm}" # last released version in fast channel = 1.4.0
        PROD_PREV_VERSION="${PROD_LAST_VERSION}"
      fi

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
      echo -e "${green}Got $bundle_image@$bundle_digest${norm}"
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

    ############################################## template created from production index, or passed in ##############################################

    # switch quay.io/rhdh references that will fail in a push to production Release
    if [[ $USE_RHEC -eq 1 ]]; then 
      sed -i "${CATALOG_DIR}/v${OCP_VERSION}/catalog-template.json" -r \
        -e "s|quay.io/rhdh|registry.redhat.io/rhdh|g"
    fi

    ############################################## render catalog content from the template ##############################################

    rm -f "${CATALOG_DIR}/v${OCP_VERSION}/configs/${prod_path}/catalog.json"
    # for 4.17+, migrate bundles' "olm.bundle.object" to "olm.csv.metadata"
    vergte "${OCP_VERSION}" "4.17" && migrateLevel="--migrate-level=bundle-object-to-csv-metadata" || migrateLevel=""
    set -x
    # shellcheck disable=SC2086
    time opm alpha render-template basic "${templateFile}" $migrateLevel > "${CATALOG_DIR}/v${OCP_VERSION}/configs/${prod_path}/catalog.json"
    set +x

    # registry selection based on OCP version
    if [[ "${OCP_VERSION}" == "${OCP_VERSION_NEXT}" ]];  then 
        registry="${BREW_REGISTRY}:v${OCP_VERSION}"
    else
        registry="${RHEL9_REGISTRY}:v${OCP_VERSION}"
    fi

    fastYChannel=""; if [[ $PROD_VERSION ]]; then fastYChannel=",fast-${PROD_VERSION}"; fi

    # if using build-image-index=false in .tekton push pipeline, append the arch to the tags (like in OSBS)
    # set to "" and re-render if switching back to build-image-index=true
    # arch="-$(uname -m)"
    arch="-x86_64"

    # echo "[INFO] Render catalogs/v${OCP_VERSION}/Containerfile for channels=fast${fastYChannel}"
    latestNextTag=""; if [[ $latestNext ]]; then latestNextTag=",${latestNext}-v${OCP_VERSION}${arch}"; fi

    cat <<EOF > "${CATALOG_DIR}/v${OCP_VERSION}/Containerfile"
  # The base image is expected to contain /bin/opm (with a serve subcommand) and /bin/grpc_health_probe
FROM ${registry}

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
  done

  if [[ $DO_COMMIT -eq 1 ]]; then
    # echo "[INFO] Commit changes to catalogs/v${OCP_VERSION}/"
    git add -f "catalogs/v${OCP_VERSION}/" build/scripts/renderCatalogs.sh || true
    # konflux trigger only: skip gitlab
    commitMsg="renderCatalogs.sh from catalogs/v${OCP_VERSION}/, in channel(s) fast${fastYChannel}, for ${PROD_VERSION}-v${OCP_VERSION}${arch}${latestNextTag}; add $PROD_FULL_VERSION"
    if [[ $USE_RHEC -eq 1 ]]; then commitMsg=":: GA PUSH :: ${commitMsg}"; fi
    git commit -s -m "$commitMsg [skip-gitlab]" "catalogs/v${OCP_VERSION}/" build/scripts/renderCatalogs.sh || true
  fi
  if [[ ${DO_PUSH} -eq 1 ]]; then
    git pull origin "${DWNSTM_BRANCH}" >/dev/null 2>&1 || true
    git push origin "${DWNSTM_BRANCH}" >/dev/null 2>&1
    echo

    if [[ $CI == "" ]]; then # not in CI mode
      waitTime="20"
      echo -n -e "${blue}Waiting ${waitTime}s for new pipeline to trigger from the above commit and push${norm}"
      for ((i = 0; i < waitTime; ++i)); do sleep 1s; echo -n -e "${blue}.${norm}"; done; echo
      oc -n rhdh-tenant get PipelineRuns --sort-by=.metadata.creationTimestamp --selector='pipelinesascode.tekton.dev/original-prname=fbc-'"${OCP_VERSION/./-}"'-on-push' -o yaml > "/tmp/fbc-pipelineruns-${OCP_VERSION}.yaml"
      # debugging
      echo -e "${green}Found pipeline run(s):${norm}"
      echo -e "${blue}timestamp\t\tmidstreamCommitSHA\t\t\t\tpipelinerunURL${norm}"
      yq -r '.items[]|select(.metadata.annotations."pipelinesascode.tekton.dev/branch" == "'"${DWNSTM_BRANCH}"'")|select(.metadata.annotations."pipelinesascode.tekton.dev/state" != "completed")|.status.conditions[0].lastTransitionTime + "\t" + .metadata.annotations."pipelinesascode.tekton.dev/sha" + "\t" + .metadata.annotations."pipelinesascode.tekton.dev/log-url"' "/tmp/fbc-pipelineruns-${OCP_VERSION}.yaml"  | tail -3

      # choose the latest run
      pipelinerun=$(yq -r '.items[]|select(.metadata.annotations."pipelinesascode.tekton.dev/branch" == "'"${DWNSTM_BRANCH}"'")|select(.metadata.annotations."pipelinesascode.tekton.dev/state" != "completed")|.metadata.annotations."pipelinesascode.tekton.dev/log-url"' "/tmp/fbc-pipelineruns-${OCP_VERSION}.yaml" | tail -1)
      if [[ $pipelinerun ]] && [[ $pipelinerun != "null" ]]; then
        PIPELINE_URL="$pipelinerun"
        echo -e "\n${green}Running in $PIPELINE_URL${norm}"
      else
        PIPELINE_URL="https://konflux-ui.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/ns/rhdh-tenant/applications/fbc-${OCP_VERSION/./-}/activity/pipelineruns"
        echo -e "\n${blue}Pipelinerun not found for branch = $DWNSTM_BRANCH - see running pipelineruns at $PIPELINE_URL${norm}"
      fi
      # open a browser to watch the release
      openURL "$PIPELINE_URL"
      echo "-----------------------------------------------------------------------"
      echo
      rm -f "/tmp/fbc-pipelineruns-${OCP_VERSION}.yaml"
    fi
  fi
done
