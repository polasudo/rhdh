#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# Utility script to push CI builds to quay and generate PRs for GA helm chart releases

RHDH_VERSION=""                                                                               # Chart release version (used as 'version' in Chart.yaml)
CHART_VERSION=""                                                                              # Developer Hub version (used as 'appVersion' in Chart.yaml and as image tag)
CATALOG_FORK="git@github.com:rhdh-bot/openshift-helm-charts.git"                              # Fork of "git@github.com:openshift-helm-charts/charts.git where you can push to
# or https://rhdh-bot:${GITHUB_TOKEN}@github.com/rhdh-bot/openshift-helm-charts.git" 
PUBLISH=0                                                                                     # Set to True to push to CATALOG_FORK
CHART_BRANCH="main"                                                                           # can also be release-1.4, etc.
CHART_NAME="redhat-developer-hub"
CHART_DIR="charts/backstage"
DELETE_OLD_BRANCHES=0 # set to 1 to purge old 1.4-zzz branches from the rhdh-bot repo when pushing a 1.4.z release to the openshift charts repo
QUAY_REGISTRY_CONFIG=""
DO_LATEST=0 # if we want to generate a chart for the :latest, we need to set a --chart-branch
DEBUG=0

# RHIDP-8242 must manually opt in to publishing new charts here, by:
# creating new quay.io/rhdh/*-chart repo, then adding more folders to this for loop
# must also add logic below to handle mapping the chart name to its URL
# look for 'if [[ "${CHART_NAME}" ==' sections
CHARTS_TO_PUBLISH="charts/backstage charts/orchestrator-infra"

EXCLUDES="next|latest|candidate|guest|containers|-source|-pr-|-tmp-|-ci-|-gh-|sha256-|on-push|on-pull|build-container|build-image-index"

THIS_SCRIPT="$0"

# TODO switch to jq wrapper version of yq (not mikefarah)
YQ="$HOME/.local/bin/yq_mf"
mikefarahyq_version=4.45.4

helmdocs_version="v1.11.3"
oras_version="1.2.2"

norm="\033[0;39m"
green="\033[1;32m"
blue="\033[1;34m"
red="\033[1;31m"

# Exit when any command fails
set -e

SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../scripts/prepareOSXARM64.sh"

[[ $(uname -m) == "arm64" ]] && [[ $(uname -o) == "Darwin" ]] && IS_ARM64_DARWIN=1 || IS_ARM64_DARWIN=0

usage() {
    echo "Utility script to push CI builds to quay and generate PRs for GA helm chart releases

Requires: both yq (python wrapper for jq) and yq from https://github.com/mikefarah/yq/ >= v$mikefarahyq_version

Usage: $0 --chart-version x.y.z --rhdh-version x.y-zzz --chart-branch release-1.4 [--catalog <git-url>] [--debug] [--publish]

NOTE: This must be run using the GITHUB_TOKEN of rhdh-bot@redhat.com in order to have PRs automerged. 

Options:
    --chart-name               Set chart name (default: $CHART_NAME). Use 'all' to publish multiple charts:
                                 $CHARTS_TO_PUBLISH
    --chart-dir                Relative path to the chart directory (default: $CHART_DIR)

    --latest --chart-branch release-1.yy   Compute the most recent 1.y-zzz tag (by semver sort rules) in quay.io/rhdh/rhdh-hub-rhel9, and use that tag in chart
    --next   --chart-branch main           Compute the most recent tag (by semver sort rules) from quay.io/rhdh/rhdh-hub-rhel9:next, and use that tag in chart

    --publish                 Push the changes to branch developer-hub-\${CHART_VERSION} of the repository specified by --catalog
    --catalog                 If publish is set, this needs to point to a fork of
                              git@github.com:openshift-helm-charts/charts.git with write access
    --chart-version           Chart release version (used as 'version' in Chart.yaml)
    --rhdh-version            Developer Hub version (used as 'appVersion' in Chart.yaml and as image tag)
                              for CI builds, use 1.y-zzz; for GA use x.y-timestamp
                              TODO: RHIDP-5431 for GA switch to semver x.y.z
    --chart-branch            branch of rhdh-charts to use as input, for example release-1.4; default: main
    --delete-old-branches     Optionally, purge old 1.4-zzz branches from the rhdh-bot repo when pushing a 1.4.z release to the openshift charts repo
                              DO NOT USE if releasing .z chart updates for CVE fixes pushed by Freshmaker
    --quay-registry-config    Path of the authentication file for registry to be used by oras to push to quay
                              If not set, will use default credentials cache
    --debug                   Enable logging
    --help                    Prints this message

This script requires following binaries to be present on the system:
    gh, git    v2             https://github.com/cli/cli/blob/trunk/docs/install_linux.md
    helm       v3             https://helm.sh/docs/intro/install
    helm-docs  $helmdocs_version        https://github.com/norwoodj/helm-docs
    oc         v4             https://console.redhat.com/openshift/downloads#tool-oc
    podman     v4             https://podman.io/
    yq         $mikefarahyq_version         https://github.com/mikefarah/yq/

Examples:
    ##### 1. Prepare and push a release to quay.io/rhdh/chart:

    # Published on every build in konflux
    $ TAG=1.y-zzz; $0 --chart-version \${TAG}-CI --rhdh-version \${TAG} \\
        --chart-branch release-\${TAG%-*} --publish
                OR
    $ TAG=1.y-zzz; $0 --chart-version \${TAG}-CI --rhdh-version \${TAG} \\
        --chart-branch main --publish
    Chart version:        1.y-zzz-CI
    Developer Hub image:  quay.io/rhdh/rhdh-hub-rhel9:1.y-zzz

    # Or, log into the quay.io and registry.redhat.io to be able to pull container metadata, then compute the latest 1.y-zz or next 1.yy-zzz
    $ export GITHUB_TOKEN=ghp_rhdh-bot-token-here
    $ $0 --latest --chart-branch release-1.6 --publish
    $ $0 --next   --chart-branch main        --publish
    Chart version:        1.next-zzz-CI
    Developer Hub image:  quay.io/rhdh/rhdh-hub-rhel9:1.next-zzz

    ##### 2. Prepare and push a release to quay.io/rhdh/orchestrator-infra-chart:

    TAG=1.y-zzz; $0 --chart-version \${TAG}-CI 
        --chart-name redhat-developer-hub-orchestrator-infra --chart-dir charts/orchestrator-infra \
        --chart-branch release-\${TAG%-*} --publish

    ##### 3. Prepare and push a RHDH chart release to https://github.com/openshift-helm-charts/charts:

    # To release the RHDH chart on GA day (container must already be LIVE in reg.rh.io!)
    # 1. use gh to log in as the bot (not using exported github token) - can use incognito browser so you don't have to log out as yourself
    $ export GITHUB_TOKEN=
    $ gh auth login -h github.com
    $ export GITHUB_TOKEN=ghp_rhdh-bot-token-here
    # 2. Run a manual release as the bot:
    $ $0 --chart-version 1.7.0 --rhdh-version 1.7.0   --chart-branch release-1.7 --publish 
    Chart version:       1.y.z
    Developer Hub image:  registry.redhat.io/rhdh/rhdh-hub-rhel9:1.y.z
    # !! NOTE !! If the PR is not created correctly, you may have to manually create it from the release-x.y.z branch.

    ##### 4. Prepare and push a Orchestrator Infra chart release to https://github.com/openshift-helm-charts/charts:

    1. Same setup as in step 3 to run as the bot. 
    2. Then run the publish with different chart-name and chart-dir values:

    $0 --chart-version 1.7.0 --rhdh-version 1.7.0 --chart-branch release-1.7 --publish \
        --chart-name redhat-developer-hub-orchestrator-infra --chart-dir charts/orchestrator-infra
"
}

# Commandline args
while [[ "$#" -gt 0 ]]; do
    case $1 in
    '--latest') DO_LATEST=1;;
    '--next')
        next_tag=$(skopeo inspect docker://quay.io/rhdh/rhdh-hub-rhel9:next | jq -r '.RepoTags[]' | \
            grep -v -E "$EXCLUDES" | grep -- "-" | sort -uV | tail -1 || true)
        RHDH_DIGEST=$(skopeo inspect docker://quay.io/rhdh/rhdh-hub-rhel9:"${next_tag}" | jq -r '.Digest')
        CHART_VERSION=${next_tag}-CI
        RHDH_VERSION=${next_tag}
        echo "Create chart for $RHDH_VERSION";;
    '--publish') PUBLISH=1;;
    '--catalog') CATALOG_FORK="$2"; shift 1;;
    '--chart-version') CHART_VERSION="$2"; shift 1;;
    '--chart-branch') CHART_BRANCH="$2"; shift 1;;
    '--rhdh-version') RHDH_VERSION="$2";
        if [[ ! $CHART_VERSION ]]; then usage; exit 1; fi

        if [[ "${CHART_NAME}" == "redhat-developer-hub" ]] || [[ "${CHART_NAME}" == "backstage" ]]; then
            if [[ $CHART_VERSION == *"CI"* ]]; then
                RHDH_DIGEST=$(skopeo inspect docker://quay.io/rhdh/rhdh-hub-rhel9:"${RHDH_VERSION}" | jq -r '.Digest')
                if [[ ! $RHDH_DIGEST ]]; then
                    echo -e "\n[ERROR] Image quay.io/rhdh/rhdh-hub-rhel9:${RHDH_VERSION} not found - Could not compute digest! Make sure the value of --rhdh-version is correct!\n\n"
                    usage; exit 1
                fi
            else
                RHDH_DIGEST=$(skopeo inspect docker://registry.redhat.io/rhdh/rhdh-hub-rhel9:"${RHDH_VERSION}" | jq -r '.Digest')
                if [[ ! $RHDH_DIGEST ]]; then
                    echo -e "\n[ERROR] Image registry.redhat.io/rhdh/rhdh-hub-rhel9:${RHDH_VERSION} not found - Could not compute digest! Make sure the value of --rhdh-version is correct!\n\n"
                    usage; exit 1
                fi
            fi
        else
           # echo -e "${blue}[INFO] Skipping RHDH_DIGEST lookup for chart: ${CHART_NAME}${norm}"
            RHDH_DIGEST="none"
        fi

        echo "Create chart for $RHDH_VERSION ($CHART_VERSION)"
        shift 1
        ;;
    '--delete-old-branches') DELETE_OLD_BRANCHES=1 ;;
    '--registry-config')
        QUAY_REGISTRY_CONFIG="--registry-config ${2}"
        shift 1
        ;;
    '--chart-name')
        CHART_NAME="$2"
        if [[ $DEBUG -eq 1 ]]; then echo -e "${blue}[DEBUG] CHART_NAME set to ${CHART_NAME}${norm}"; fi
        shift 1
        ;;
    '--chart-dir')
        CHART_DIR="$2"
        if [[ $DEBUG -eq 1 ]]; then echo -e "${blue}[DEBUG] CHART_DIR set to ${CHART_DIR}${norm}"; fi
        shift 1
        ;;
    '--debug')
        DEBUG=1
        ;;
    '--help') usage; exit 0;;
    esac
    shift 1
done

if [[ $DO_LATEST -eq 1 ]]; then
    if [[ ! $CHART_BRANCH ]] || [[ $CHART_BRANCH == "main" ]]; then usage; exit 1; fi
    # get all tags but find the ones starting with 1.yy-, then sort those and return the most recent one
    CHART_FILTER="${CHART_BRANCH/release-/}"
    next_tag=$(skopeo inspect docker://quay.io/rhdh/rhdh-hub-rhel9:next | jq -r '.RepoTags[]' | \
        grep -v -E "$EXCLUDES" | \
        grep -- "-" | grep "${CHART_FILTER}" | sort -uV | tail -1 || true)
    RHDH_DIGEST=$(skopeo inspect docker://quay.io/rhdh/rhdh-hub-rhel9:"${next_tag}" | jq -r '.Digest')
    CHART_VERSION=${next_tag}-CI
    RHDH_VERSION=${next_tag}
    echo "Create chart for $RHDH_VERSION ($CHART_BRANCH)"
fi

# only need RHDH_VERSION for a RHDH chart release; not required for orch infra chart
if [[ ! $RHDH_VERSION ]] && [[ "${CHART_NAME}" != "redhat-developer-hub-orchestrator-infra" ]]; then
    usage; exit 1
fi

HELM_DIR=$(mktemp -d)
if [[ $DEBUG -eq 1 ]]; then echo -e "${blue}[DEBUG] Running in HELM_DIR = $HELM_DIR${norm}"; fi
CATALOG_DIR=$(mktemp -d)
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
HELM_DOCS_LOG_LEVEL="fatal"

# TODO install the latest jq wrapper version of yq (not mikefarah)
# if ! command -v yq &> /dev/null; then
#     PYTHON_VERSION="3.9"
#     echo "Installing jq and yq for python $PYTHON_VERSION ..."
#     sudo dnf -y -q module install python39:${PYTHON_VERSION}
#     sudo dnf -y -q jq
#     python${PYTHON_VERSION} -m pip install --user --no-cache-dir --upgrade pip setuptools yq
# fi

# Function to install rpm package
install_rpm_package() {   
    if [[ $IS_ARM64_DARWIN -eq 1 ]]; then
        return
    fi
    
    local rpm_repo="$1"
    local package="$2"
    local rpm_package="${3:-$package}"
    
    if ! command -v "$package" &>/dev/null; then
        echo "Installing $package from $rpm_repo ..."
        sudo dnf config-manager --add-repo "$rpm_repo" -q >/dev/null 2>&1 || true
        sudo dnf -y -q install "$rpm_package" >/dev/null 2>&1   
    fi
}

# Install packages (skip on ARM64 Darwin, because already installed via build/scripts/prepareOSXARM64.sh)
if [[ $IS_ARM64_DARWIN -eq 0 ]]; then

    # TODO switch to jq wrapper version of yq (not mikefarah)
    if ! command -v "$YQ" &> /dev/null; then
        mkdir -p "$HOME/.local/bin/"
        echo -e "${blue}Installing mikefarah yq version $mikefarahyq_version for $(uname -m -o) ...${norm}"
        if [[ "$(uname -m -o)" == "x86_64 GNU/Linux" ]]; then
            curl -sSLo "$YQ" https://github.com/mikefarah/yq/releases/download/v${mikefarahyq_version}/yq_linux_amd64
        else 
            usage; echo -e "${red}[ERROR] Please install yq v${mikefarahyq_version} from https://github.com/mikefarah/yq/ for your arch to ${YQ}${norm}"; exit 1
        fi
        chmod +x "$YQ"
    fi 

    install_rpm_package "https://cli.github.com/packages/rpm/gh-cli.repo" "gh" 
    install_rpm_package "https://rhsm-pulp.corp.redhat.com/content/dist/layered/rhel9/x86_64/ocp-tools/4.18/os/" "helm"

    OCP_REPO="https://rhsm-pulp.corp.redhat.com/content/dist/layered/rhel9/x86_64/rhocp/4.18/os/"
    install_rpm_package "$OCP_REPO" "podman" 
    install_rpm_package "$OCP_REPO" "oc" "openshift-clients"
    
    # Install helm-docs
    if ! command -v helm-docs &>/dev/null; then
        helmdocrepo=github.com/norwoodj/helm-docs/cmd/helm-docs@${helmdocs_version}
        echo "Installing $helmdocrepo to ${HOME}/go/bin/helm-docs ..."
        sudo dnf -y -q install brotli-devel cmake gcc gcc-c++ git golang >/dev/null 2>&1
        GO111MODULE=on go install $helmdocrepo >/dev/null 2>&1
        export PATH="$PATH:${HOME}/go/bin"
    fi
    
    if ! command -v oras &>/dev/null; then
        orasrepo="https://github.com/oras-project/oras/releases/download/v${oras_version}/"
        orastar="oras_${oras_version}_linux_amd64.tar.gz"
        echo "Installing oras from $orasrepo ..."
        curl -sSLO "${orasrepo}${orastar}"
        sudo tar -zxf $orastar -C /usr/local/bin/ oras
        rm -rf $orastar oras-install/
    fi
fi

for c in gh git helm helm-docs oc podman oras $YQ; do
    if ! command -v "$c" &>/dev/null; then
        echo "Command not found: '$c'"
        usage; exit 1
    fi
done

if [[ $DEBUG -eq 1 ]]; then
    HELM_DOCS_LOG_LEVEL="warning"
    echo -e "${blue}[DEBUG] Clone https://github.com/redhat-developer/rhdh-chart/tree/${CHART_BRANCH}/charts to $HELM_DIR${norm}"
fi
# skip binaries with --filter=blob:none
git clone --depth=1 -q --branch="${CHART_BRANCH}" https://github.com/redhat-developer/rhdh-chart.git "${HELM_DIR}" >/dev/null

if [[ "$CHART_NAME" == "all" ]]; then
    echo -e "${green}[INFO] Multi-chart mode: will publish all charts in https://github.com/redhat-developer/rhdh-chart/tree/$CHART_BRANCH/charts${norm}"
    # echo "Working dir: $HELM_DIR ..." 
    for chart_path in $CHARTS_TO_PUBLISH; do 
        name=$(basename "$chart_path"); 
        echo -e "\n===========================\n[INFO] Publishing chart $name from $chart_path\n===========================\n"
        if [[ $DEBUG -eq 1 ]]; then DEBUGFLAG="--debug"; else DEBUGFLAG=""; fi
        # shellcheck disable=SC2086
        "$THIS_SCRIPT" \
            --chart-name "${name}" \
            --chart-dir "${chart_path}" \
            --chart-version "$CHART_VERSION" \
            --rhdh-version "$RHDH_VERSION" \
            --chart-branch "$CHART_BRANCH" \
            --publish \
            --catalog "$CATALOG_FORK" \
            ${QUAY_REGISTRY_CONFIG} ${DEBUGFLAG}
        rc=$?
        if [[ $rc -ne 0 ]]; then
            echo -e "${red}[ERROR] Failed to publish chart: $name (exit code $rc)${norm}"
            exit $rc
        fi
        echo -e "\n===========================\n[INFO] Chart $name published\n===========================\n"
    done
    echo -e "${green}[INFO] All charts published successfully.${norm}"
    rm -fr "${HELM_DIR}"
    exit 0
fi

if [[ $DEBUG -eq 1 ]]; then
    echo -e "${blue}[DEBUG] Patching 'Chart.yaml', 'values.yaml', 'README.md.gotmpl' from branch ${CHART_BRANCH} ...${norm}"
fi

# TODO revise these to use jq wrapper version of yq (not mikefarah)
CHART_PATH="${HELM_DIR}/${CHART_DIR}/Chart.yaml"
VALUES_PATH="${HELM_DIR}/${CHART_DIR}/values.yaml"
CHART_ACTUAL_NAME=$($YQ '.name' "$CHART_PATH" | tr -d '"')
if [[ "$CHART_ACTUAL_NAME" == "redhat-developer-hub-orchestrator-infra" ]]; then
  echo -e "${green}[INFO] Set Orchestrator Infra chart version to ${CHART_VERSION}${norm}"

  # TODO why do we extract, escape, then set description using the same information?
  # Extract raw description as plain string
  RAW_DESC=$($YQ eval -o=json '.description' "$CHART_PATH" | jq -r '.')
  # Escape single quotes for YAML (YAML requires '' inside '...')
  ESCAPED_DESC="${RAW_DESC/\'/\'\'}"
  # Strip .description, rebuild Chart.yaml with new content
  TMP_CHART=$(mktemp)
  $YQ 'del(.description)' "$CHART_PATH" > "$TMP_CHART"
  # Append description safely as a single-quoted YAML string
  echo "description: '$ESCAPED_DESC'" >> "$TMP_CHART"

  # Set .version and .name
  # TODO: why use --inplace with a separate file when we can transform in place?
  $YQ eval ".version = \"$CHART_VERSION\"" --inplace "$TMP_CHART"
  $YQ eval ".name = \"redhat-developer-hub-orchestrator-infra\"" --inplace "$TMP_CHART"
  # Overwrite the original Chart.yaml
  mv "$TMP_CHART" "$CHART_PATH"
fi

if [[ "${CHART_NAME}" == "redhat-developer-hub" ]] || [[ "${CHART_NAME}" == "backstage" ]]; then

    sed -i "$CHART_PATH" -r \
        `# change .name from backstage to redhat-developer-hub` \
        -e "s/^name: backstage/name: redhat-developer-hub/"
    if [[ ! -f "${SCRIPT_DIR}/Chart_patch.yaml" ]]; then 
        sed -i "$CHART_PATH" -r \
            `# change version to 1.7-46-CI; add appVersion 1.7-46` \
            -e "s/^version: (.+)/version: $CHART_VERSION\nappVersion: ${CHART_VERSION/-CI}/"
    fi

    POSTGRESQL_DIGEST=$(skopeo inspect docker://registry.redhat.io/rhel9/postgresql-15:latest | jq -r '.Digest')
    # trim the sha256: prefix off, since we're treating this like a tag
    # image.repository already ends in @sha256
    POSTGRESQL_DIGEST="${POSTGRESQL_DIGEST//sha256:/}"
    RHDH_DIGEST="${RHDH_DIGEST//sha256:/}"
    if [[ ! "$RHDH_DIGEST" ]] || [[ ! "$POSTGRESQL_DIGEST" ]]; then
        echo "[ERROR] Could not compute image digests for ${VALUES_PATH} - must exit!
* RHDH_DIGEST = $RHDH_DIGEST,
* POSTGRESQL_DIGEST = $POSTGRESQL_DIGEST"; exit 1
    else
        echo "[INFO] Set image digests in ${VALUES_PATH}:
* RHDH_DIGEST = $RHDH_DIGEST,
* POSTGRESQL_DIGEST = $POSTGRESQL_DIGEST"
    fi

    if [[ $CHART_VERSION == *"CI"* ]]; then 
        $YQ -i "
        . *= load(\"${SCRIPT_DIR}/values_patch.yaml\") |
        .upstream.backstage.image.registry=\"quay.io\" |
        .upstream.backstage.image.tag=\"${RHDH_DIGEST}\" |
        .upstream.postgresql.image.tag=\"${POSTGRESQL_DIGEST}\"
        " "$VALUES_PATH"
    else
        $YQ -i "
        . *= load(\"${SCRIPT_DIR}/values_patch.yaml\") |
        .upstream.backstage.image.tag=\"${RHDH_DIGEST}\" |
        .upstream.postgresql.image.tag=\"${POSTGRESQL_DIGEST}\"
        " "$VALUES_PATH"
    fi
else
    echo -e "${blue}[WARN] No patch to $VALUES_PATH required for ${CHART_NAME} - skip.${norm}"
fi

TEST_TEMPLATE="${HELM_DIR}/${CHART_DIR}/templates/tests/test-connection.yaml"
if [[ -f "$TEST_TEMPLATE" ]]; then
    sed -e "s%quay.io/curl/curl:latest%registry.redhat.io/ubi9:latest%" -i "$TEST_TEMPLATE"
else
    echo -e "${blue}[WARN] No test-connection.yaml found for ${CHART_NAME}, skipping patch.${norm}"
fi

# yq '.upstream.backstage.image , .upstream.postgresql.image' "${HELM_DIR}"/charts/backstage/values.yaml

if [[ "${CHART_NAME}" == "redhat-developer-hub" ]] || [[ "${CHART_NAME}" == "backstage" ]]; then
    cp "${SCRIPT_DIR}/README.md.gotmpl" "${HELM_DIR}/${CHART_DIR}/README.md.gotmpl"
fi
helm-docs --chart-search-root="${HELM_DIR}"/charts --template-files=./_templates.gotmpl --template-files=README.md.gotmpl --log-level="$HELM_DOCS_LOG_LEVEL"

if [[ $DEBUG -eq 1 ]]; then
    echo -e "${blue}[DEBUG] Building dependencies...${norm}"
fi
helm repo add --force-update bitnami https://charts.bitnami.com/bitnami 1>/dev/null
helm repo add --force-update backstage https://backstage.github.io/charts 1>/dev/null

if [[ $DEBUG -eq 1 ]]; then
    echo -e "${blue}[DEBUG] Building helm deps in ${HELM_DIR}/${CHART_DIR} ...${norm}"
fi
helm dependency build "${HELM_DIR}/${CHART_DIR}" 1>/dev/null
if [[ $DEBUG -eq 1 ]]; then
    echo -e "${blue}[DEBUG] Fetching Helm catalog into ${CATALOG_DIR} ...${norm}"
fi
git clone --filter=blob:none --no-checkout --depth=1 -q "${CATALOG_FORK}" "${CATALOG_DIR}" && cd "${CATALOG_DIR}"
git sparse-checkout init --cone >/dev/null
git read-tree -mu HEAD >/dev/null

rm -f "${CATALOG_DIR}/charts/redhat/redhat/${CHART_NAME}/${CHART_VERSION}/${CHART_NAME}-${CHART_VERSION}.tgz"
PACKAGE_DEST="${CATALOG_DIR}/charts/redhat/redhat/${CHART_NAME}/${CHART_VERSION}"
mkdir -p "$PACKAGE_DEST"
helm package "${HELM_DIR}/${CHART_DIR}" -d "$PACKAGE_DEST" 1>/dev/null
ls -lh "${PACKAGE_DEST}"
echo -e "${green}[INFO] Packaging chart to ${PACKAGE_DEST}${norm}"
helm package "${HELM_DIR}/${CHART_DIR}" -d "$PACKAGE_DEST"
if [[ $DEBUG -eq 1 ]]; then
    echo -e "${blue}[DEBUG] Contents of ${HELM_DIR}/${CHART_DIR}:${norm}"
    ls -lh "${HELM_DIR}/${CHART_DIR}"
fi

git config --global user.email "rhdh-bot@redhat.com"
git config --global user.name "RHDH Build (rhdh-bot)"
git config --global push.default matching
git config --global pull.rebase false

mkdir "${CATALOG_DIR}"/installation -p

# Clean up remnants from old helm chart system used
rm -f "${CATALOG_DIR}"/installation/index.yaml

echo -e "${green}[INFO] Chart name:    ${CHART_NAME}${norm}"
echo -e "${green}[INFO] Chart version: ${CHART_VERSION}${norm}"
if [[ $PUBLISH -eq 1 ]] && [[ $CHART_VERSION != *"CI"* ]]; then # include installation folder only for CI builds (not for GA)
    echo -e "${green}[INFO] Developer Hub image:  registry.redhat.io/rhdh/rhdh-hub-rhel9:${RHDH_VERSION}${norm}"
else
    echo -e "${green}[INFO] Developer Hub image:  quay.io/rhdh/rhdh-hub-rhel9:${RHDH_VERSION}${norm}"
fi
echo -e "${green}[INFO] Full repo folder:     $CATALOG_DIR${norm}"
echo -e "${green}[INFO] This chart's folder:  $PACKAGE_DEST${norm}"

if [[ $PUBLISH -eq 1 ]]; then
    helm_config="${PACKAGE_DEST}/chart_dump.json"
    actual_chart=$(find "${PACKAGE_DEST}/" -name "*.tgz")
    if [[ ! "${actual_chart}" ]] || [[ ! -f "${actual_chart}" ]]; then 
        echo -e "${red}[ERROR] Could not find chart in ${PACKAGE_DEST} - must exit!${norm}"; exit 1
    fi

    helm show chart "${actual_chart}" | $YQ -p yaml -o json > "${helm_config}"; # cat "${helm_config}"
    # push to quay.io/rhdh/*chart according to the rules below
    if [[ "$CHART_NAME" == "redhat-developer-hub-orchestrator-infra" ]] || [[ "$CHART_NAME" == "orchestrator-infra" ]]; then
        TARGET_REPO="orchestrator-infra-chart"
    elif [[ "${CHART_NAME}" == "redhat-developer-hub" ]] || [[ "${CHART_NAME}" == "backstage" ]]; then
        TARGET_REPO="chart"
    else
        TARGET_REPO="${CHART_NAME}-chart"
    fi
    # set -x 
    echo -e "${green}[INFO] Publish Helm chart to quay.io/rhdh/${TARGET_REPO}:${CHART_VERSION} ...${norm}"
    # shellcheck disable=SC2086
    oras push "quay.io/rhdh/${TARGET_REPO}:${CHART_VERSION}" \
        "${actual_chart}:application/vnd.cncf.helm.chart.content.v1.tar+gzip" \
        --disable-path-validation --config "${helm_config}:application/vnd.cncf.helm.config.v1+json" $QUAY_REGISTRY_CONFIG

    # remove any leftover tarballs from a previous run
    cd /tmp

    # update installation/README.md and installation/rhdh-next-ci-repo.yaml, expanding variables
    export CHART_VERSION="${CHART_VERSION}"
    CHART_VERSION_OCP=$(echo "$CHART_VERSION" | tr "." "-" | tr "[:upper:]" "[:lower:]")
    export CHART_VERSION_OCP="${CHART_VERSION_OCP}"
    envsubst <"${SCRIPT_DIR}/installation/README.tmpl.md" >"${CATALOG_DIR}"/installation/README.md

    # include installation script, tuned to the current build
    sed -r -e "s|x.y-zzz-CI|${CHART_VERSION}|" "${SCRIPT_DIR}/install.sh" >"${CATALOG_DIR}"/installation/install.sh

    # force push new files to the developer-hub-"${CHART_VERSION}" branch
    if [[ $CHART_VERSION != *"CI"* ]]; then # If it's a GA build
        # create a PR against the openshift-helm-charts/charts repo, containing ONLY the tarball,
        # none of the installation instructions/scripts/chart repo
        pushd /tmp >/dev/null || exit 1
        rm -fr /tmp/openshift-helm-charts-main
        git clone git@github.com:openshift-helm-charts/charts.git -q --depth=1 -b "main" "openshift-helm-charts-main"  >/dev/null 
        popd >/dev/null || exit 1

        # create PR including new tarball
        pushd "openshift-helm-charts-main/charts/redhat/redhat/${CHART_NAME}/" >/dev/null || exit 1
        rsync -aqrz "${actual_chart}" "${CHART_VERSION}/"
        git checkout main >/dev/null 2>&1 
        echo -e "${green}[INFO] The following step will fail if there's an existing chart $CHART_VERSION at https://github.com/openshift-helm-charts${norm}"
        echo -e "${green}[INFO] You need to bump the chart version or the PR will fail validation with error: Helm chart release already exists in the index.${norm}"
        git pull origin main >/dev/null
        git pull origin >/dev/null
        git remote add rhdh-bot git@github.com:rhdh-bot/openshift-helm-charts.git
        git checkout origin/main -b "release-${CHART_NAME}-${CHART_VERSION}" >/dev/null 2>&1 || true
        git checkout "release-${CHART_NAME}-${CHART_VERSION}" >/dev/null 2>&1 || true
        git add "${CHART_VERSION}"
        COMMIT_MSG="chore: add Red Hat Developer Hub chart: ${CHART_NAME} ${CHART_VERSION}"
        git commit --no-gpg-sign -s -m "${COMMIT_MSG}" "${CHART_VERSION}" .
        # delete branch (if exists)
        if [[ $(git ls-remote --heads git@github.com:rhdh-bot/openshift-helm-charts.git "refs/heads/release-${CHART_NAME}-${CHART_VERSION}") ]]; then
            git push rhdh-bot ":release-${CHART_NAME}-${CHART_VERSION}" >/dev/null 2>&1 || true
        fi
        # create new branch
        git push rhdh-bot "release-${CHART_NAME}-${CHART_VERSION}" >/dev/null 2>&1

        # Option 1: open the PR creation page
        echo -e "${green}[INFO] Create PR https://github.com/openshift-helm-charts/charts/compare/main...rhdh-bot:openshift-helm-charts:release-${CHART_NAME}-${CHART_VERSION}?expand=1 ...${norm}"

        # Option 2: create the PR automatically
        gh repo set-default openshift-helm-charts/charts
        gh pr create -t "${COMMIT_MSG}" -b "${COMMIT_MSG}" --base main --head "rhdh-bot:release-${CHART_NAME}-${CHART_VERSION}"
        # open new PR in a browser
        URL=$(gh pr view "rhdh-bot:release-${CHART_NAME}-${CHART_VERSION}" --json 'url' | jq -r '.url')
        google-chrome --incognito "$URL" || true
        popd >/dev/null || exit 1
        rm -fr /tmp/openshift-helm-charts-main
    fi

    if [[ $CHART_VERSION != *"CI"* ]] && [[ $DELETE_OLD_BRANCHES -eq 1 ]]; then
        # purge old CI branches, but keep the most recent one (sort -V | head -n -1)
        rm -fr "${CATALOG_DIR}"
        git clone -q "${CATALOG_FORK}" "${CATALOG_DIR}" >/dev/null 2>&1
        pushd "${CATALOG_DIR}" >/dev/null || exit 1
        # git remote -v
        # new branch name after April 9 2024
        for d in $(git branch -a | grep -E "remotes/.*/redhat-developer-hub" | grep "${CHART_NAME}-${RHDH_VERSION%-*}-" | grep CI | sed -r -e "s#.*remotes/[^/]+/##" | sort -V | head -n -1); do
            git push origin ":${d}" >/dev/null 2>&1
            echo "Branch $d deleted"
        done
        # old branch name up to April 9 2024
        for d in $(git branch -a | grep -E "remotes/.*/developer-hub" | grep "developer-hub-${RHDH_VERSION%-*}-" | grep CI | sed -r -e "s#.*remotes/[^/]+/##" | sort -V | head -n -1); do
            git push origin ":${d}" >/dev/null 2>&1
            echo "Branch $d deleted"
        done
        popd >/dev/null || exit 1
    fi

    # shellcheck disable=SC2035
    rm -fr *eveloper-hub-*.tgz
else
    HELM_PROJECT="rhdh-${CHART_VERSION,,}"
    HELM_PROJECT="${HELM_PROJECT//./-}"
    echo ""
    echo -e "Flag '--publish' is not set. Changes are not pushed to '$CATALOG_FORK'. Instead they can be previewed in:

Full repo folder:     $CATALOG_DIR
This chart's folder:  $PACKAGE_DEST

${green}To install this chart, run the following commands against your OCP cluster:${norm}

    oc new-project $HELM_PROJECT

    pushd ${PACKAGE_DEST}/ >/dev/null; \\
        tar xzf ${CHART_NAME}-${CHART_VERSION}.tgz && \\
        helm upgrade redhat-developer-hub -i -n $HELM_PROJECT redhat-developer-hub/; \\
        PASSWORD=\$(kubectl get secret ${CHART_NAME}-postgresql -o jsonpath=\"{.data.password}\" | base64 -d); \\
        CLUSTER_ROUTER_BASE=\$(oc get route console -n openshift-console -o=jsonpath='{.spec.host}' | sed 's/^[^.]*\.//'); \\
        helm upgrade redhat-developer-hub -n $HELM_PROJECT \\
        --set global.clusterRouterBase=\"\${CLUSTER_ROUTER_BASE}\" \\
        --set global.postgresql.auth.password=\"\$PASSWORD\" redhat-developer-hub/; \\
    popd >/dev/null
"
fi

if [[ $PUBLISH -eq 1 ]]; then
    # delete temp folders
    rm -fr "${HELM_DIR}" "${CATALOG_DIR}" "${CATALOG_DIR}-2" 
else
    echo "To clean up, run this:
    rm -fr \"${HELM_DIR}\" \"${CATALOG_DIR}\" \"${CATALOG_DIR}-2\""
fi
