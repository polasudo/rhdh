#!/usr/bin/bash

RHDH_VERSION=""                                                                               # Chart release version (used as 'version' in Chart.yaml)
CHART_VERSION=""                                                                              # Developer Hub version (used as 'appVersion' in Chart.yaml and as image tag)
CATALOG_FORK="https://rhdh-bot:${GITHUB_TOKEN}@github.com/rhdh-bot/openshift-helm-charts.git" # Fork of "git@github.com:openshift-helm-charts/charts.git where you can push to
PUBLISH=0                                                                                     # Set to True to push to CATALOG_FORK
CHART_BRANCH="main"                                                                           # can also be release-1.4, etc.
CHART_NAME="redhat-developer-hub"
CHART_DIR="charts/backstage"
EXTRA_BRANCH=""       # another branch to force push, eg., rhdh-1.4-rhel-9
DELETE_OLD_BRANCHES=0 # set to 1 to purge old 1.4-zzz branches from the rhdh-bot repo when pushing a 1.4.z release to the openshift charts repo
QUAY_REGISTRY_CONFIG=""
DO_LATEST=0 # if we want to generate a chart for the :latest, we need to set a --chart-branch
DEBUG=0
QUIET="-q"

EXCLUDES="next|latest|candidate|guest|containers|-source|-pr-|-tmp-|-ci-|-gh-|sha256-|on-push|on-pull|build-container|build-image-index"

THIS_SCRIPT="$0"

# TODO switch to jq wrapper version of yq (not mikefarah)
mikefarahyq_version="4.35.2"
helmdocs_version="v1.11.3"
oras_version="1.2.2"
# Exit when any command fails
set -e

usage() {
    echo "Usage: $0 --chart-version x.y.z --rhdh-version x.y-zzz --chart-branch release-1.4 [--catalog <git-url>] [--debug] [--publish]

NOTE: This must be run using the GITHUB_TOKEN of rhdh-bot@redhat.com in order to push to that user's fork.

Options:
    --chart-name               Override the chart name (default: $CHART_NAME). Use 'all' to iterate and publish all charts in ./charts/

    --chart-dir                Relative path to the chart directory (default: $CHART_DIR)

    --latest --chart-branch release-1.yy   Compute the most recent 1.y-zzz tag (by semver sort rules) in quay.io/rhdh/rhdh-hub-rhel9, and use that tag in chart
    --next   --chart-branch main           Compute the most recent tag (by semver sort rules) from quay.io/rhdh/rhdh-hub-rhel9:next, and use that tag in chart

    --publish                 Push the changes to branch developer-hub-\${CHART_VERSION} of the repository specified by --catalog
    --extra-branch            Push changes to an extra branch, such as rhdh-1.4-rhel-9
    --create-report           Create a report via https://github.com/redhat-certification/chart-verifier.
                              [IMPORTANT!] Requires local user to be logged into an OCP cluster
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
    yq         $mikefarahyq_version             https://github.com/mikefarah/yq/

Examples:
    Prepare and push a release to git@github.com:[your-github-fork]/openshift-helm-charts.git:

    # Published on every build in gitlab via the rhdh-bot user - see RHIDP-33
    $ TAG=1.y-zzz; $0 --chart-version \${TAG}-CI --rhdh-version \${TAG} --extra-branch rhdh-1.y-rhel-9 \\
        --chart-branch release-1.y --catalog git@github.com:rhdh-bot/openshift-helm-charts.git --publish
    Chart version:        1.y-zzz-CI
    Developer Hub image:  quay.io/rhdh/rhdh-hub-rhel9:1.y-zzz

     # Or, log into the quay.io and registry.redhat.io to be able to pull container metadata, then compute the latest 1.5-zz or next 1.6-zzz tag
    $ export GITHUB_TOKEN=ghp_rhdh-bot-token-here
    $ $0 --latest --chart-branch release-1.5 --publish --extra-branch rhdh-1.5-rhel-9
    $ $0 --next   --chart-branch main        --publish --extra-branch rhdh-1-rhel-9
    Chart version:        1.next-zzz-CI
    Developer Hub image:  quay.io/rhdh/rhdh-hub-rhel9:1.next-zzz

    # Run this manually on GA release day
    # 1. use gh to log in as the bot (not using exported github token) - can use incognito browser so you don't have to log out as yourself
    $ export GITHUB_TOKEN=
    $ gh auth login -h github.com
    # 2. get the latest timestamp tag for the live GA container at https://catalog.redhat.com/software/containers/rhdh/rhdh-hub-rhel9/645bd4c15c00598369c31aba
    # 3. Run a manual release as the bot:
    $ export GITHUB_TOKEN=ghp_rhdh-bot-token-here
    $ $0 --chart-version 1.5.1 --rhdh-version 1.5.1   --chart-branch release-1.5 --catalog git@github.com:rhdh-bot/openshift-helm-charts.git --publish
    $ $0 --chart-version 1.4.2 --rhdh-version 1.4.2   --chart-branch release-1.4 --catalog git@github.com:rhdh-bot/openshift-helm-charts.git --publish
    Chart version:       1.y.z
    Developer Hub image:  quay.io/rhdh/rhdh-hub-rhel9:1.y-zzz

    # NOTE that the PR may not be created correctly; you may have to manually create a PR from the release-x.y.z branch.

    # Example of usage for publishing the redhat-developer-hub-orchestrator-infra
    $0 \
        --chart-version 1.6.0-CI \
        --chart-name redhat-developer-hub-orchestrator-infra \
        --chart-dir charts/orchestrator-infra \
        --chart-branch release-1.6 \
        --catalog git@github.com:rhdh-bot/openshift-helm-charts.git \
        --publish \
        --debug

"
    exit
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
    '--extra-branch') EXTRA_BRANCH="$2"; shift 1;;
    '--publish') PUBLISH=1;;
    '--catalog') CATALOG_FORK="$2"; shift 1;;
    '--chart-version') CHART_VERSION="$2"; shift 1;;
    '--chart-branch') CHART_BRANCH="$2"; shift 1;;
    '--rhdh-version') RHDH_VERSION="$2";
        if [[ ! $CHART_VERSION ]]; then usage; fi

        if [[ "${CHART_NAME}" == "redhat-developer-hub" ]] || [[ "${CHART_NAME}" == "backstage" ]]; then
            if [[ $CHART_VERSION == *"CI"* ]]; then
                RHDH_DIGEST=$(skopeo inspect docker://quay.io/rhdh/rhdh-hub-rhel9:"${RHDH_VERSION}" | jq -r '.Digest')
                if [[ ! $RHDH_DIGEST ]]; then
                    echo -e "\n[ERROR] Image quay.io/rhdh/rhdh-hub-rhel9:${RHDH_VERSION} not found - Could not compute digest! Make sure the value of --rhdh-version is correct!\n\n"
                    usage
                fi
            else
                RHDH_DIGEST=$(skopeo inspect docker://registry.redhat.io/rhdh/rhdh-hub-rhel9:"${RHDH_VERSION}" | jq -r '.Digest')
                if [[ ! $RHDH_DIGEST ]]; then
                    echo -e "\n[ERROR] Image registry.redhat.io/rhdh/rhdh-hub-rhel9:${RHDH_VERSION} not found - Could not compute digest! Make sure the value of --rhdh-version is correct!\n\n"
                    usage
                fi
            fi
        else
           # echo "[INFO] Skipping RHDH_DIGEST lookup for chart: ${CHART_NAME}"
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
        if [[ $DEBUG -eq 1 ]]; then echo "[DEBUG] CHART_NAME set to ${CHART_NAME}"; fi
        shift 1
        ;;
    '--chart-dir')
        CHART_DIR="$2"
        if [[ $DEBUG -eq 1 ]]; then echo "[DEBUG] CHART_DIR set to ${CHART_DIR}"; fi
        shift 1
        ;;
    '--debug')
        DEBUG=1
        QUIET=""
        ;;
    '--help') usage ;;
    esac
    shift 1
done

if [[ $DO_LATEST -eq 1 ]]; then
    if [[ ! $CHART_BRANCH ]] || [[ $CHART_BRANCH == "main" ]]; then usage; fi
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
    usage
fi

if [[ $CHART_NAME == "redhat-developer-hub" ]]; then
    POSTGRESQL_DIGEST=$(skopeo inspect docker://registry.redhat.io/rhel9/postgresql-15:latest | jq -r '.Digest')

    # trim the sha256: prefix off, since we're treating this like a tag
    # image.repository already ends in @sha256
    POSTGRESQL_DIGEST="${POSTGRESQL_DIGEST//sha256:/}"
    RHDH_DIGEST="${RHDH_DIGEST//sha256:/}"
fi

HELM_DIR=$(mktemp -d)
if [[ $DEBUG -eq 1 ]]; then echo "Running in HELM_DIR = $HELM_DIR"; fi
CATALOG_DIR=$(mktemp -d)
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
# TODO switch to jq wrapper version of yq (not mikefarah)
YQ=${SCRIPT_DIR}/yq_mf
HELM_DOCS_LOG_LEVEL="fatal"

# TODO install the latest jq wrapper version of yq (not mikefarah)
# if ! command -v yq &> /dev/null; then
#     PYTHON_VERSION="3.9"
#     echo "Installing jq and yq for python $PYTHON_VERSION ..."
#     sudo dnf -y -q module install python39:${PYTHON_VERSION}
#     sudo dnf -y -q jq
#     python${PYTHON_VERSION} -m pip install --user --no-cache-dir --upgrade pip setuptools yq
# fi

if ! command -v gh &>/dev/null; then
    ghclirepo=https://cli.github.com/packages/rpm/gh-cli.repo
    echo "Intalling gh from $ghclirepo ..."
    sudo dnf config-manager --add-repo $ghclirepo -q && sudo dnf -y -q install gh >/dev/null 2>&1
fi
if ! command -v helm &>/dev/null; then
    helmrpmrepo="https://rhsm-pulp.corp.redhat.com/content/dist/layered/rhel8/x86_64/ocp-tools/4.12/os/"
    echo "Installing helm from $helmrpmrepo ..."
    sudo dnf config-manager --add-repo $helmrpmrepo -q && sudo dnf -y -q install helm >/dev/null 2>&1
fi
if ! command -v helm-docs &>/dev/null; then
    helmdocrepo=github.com/norwoodj/helm-docs/cmd/helm-docs@${helmdocs_version}
    echo "Installing $helmdocrepo to ${HOME}/go/bin/helm-docs ..."
    sudo dnf -y -q install brotli-devel cmake gcc gcc-c++ git golang >/dev/null 2>&1
    GO111MODULE=on go install $helmdocrepo
    export PATH="$PATH:${HOME}/go/bin"
fi
if ! command -v oc &>/dev/null; then
    ocrpmrepo="https://rhsm-pulp.corp.redhat.com/content/dist/layered/rhel8/x86_64/rhocp/4.12/os/"
    echo "Installing oc from $ocrpmrepo ..."
    sudo dnf config-manager --add-repo $ocrpmrepo -q && sudo dnf -y -q install openshift-clients >/dev/null 2>&1
fi
if ! command -v podman &>/dev/null; then
    ocrpmrepo="https://rhsm-pulp.corp.redhat.com/content/dist/layered/rhel8/x86_64/rhocp/4.12/os/"
    echo "Installing podman from $ocrpmrepo ..."
    sudo dnf config-manager --add-repo $ocrpmrepo -q && sudo dnf -y -q install podman >/dev/null 2>&1
fi
if ! command -v oras &>/dev/null; then
    orasrepo="https://github.com/oras-project/oras/releases/download/v${oras_version}/"
    orastar="oras_${oras_version}_linux_amd64.tar.gz"
    echo "Installing oras from $orasrepo ..."
    curl -sSLO "${orasrepo}${orastar}"
    sudo tar -zxf $orastar -C /usr/local/bin/ oras
    rm -rf $orastar oras-install/
fi
# TODO switch to jq wrapper version of yq (not mikefarah)
if ! command -v $YQ &>/dev/null; then
    echo "Installing mikefarah yq version $mikefarahyq_version ..."
    curl -sSLo $YQ https://github.com/mikefarah/yq/releases/download/v${mikefarahyq_version}/yq_linux_amd64 && chmod +x "$YQ"
fi

for c in gh git helm helm-docs oc podman $YQ; do
    if ! command -v "$c" &>/dev/null; then
        echo "Command not found: '$c'"
        usage
    fi
done

if [[ $DEBUG -eq 1 ]]; then
    HELM_DOCS_LOG_LEVEL="warning"
    echo "[DEBUG] Clone https://github.com/redhat-developer/rhdh-chart/tree/${CHART_BRANCH}/charts to $HELM_DIR"
fi
# skip binaries with --filter=blob:none
git clone --depth=1 -q --branch="${CHART_BRANCH}" https://github.com/redhat-developer/rhdh-chart.git "${HELM_DIR}"

if [[ "$CHART_NAME" == "all" ]]; then
    echo "[INFO] Multi-chart mode: will publish all charts in https://github.com/redhat-developer/rhdh-chart/tree/$CHART_BRANCH/charts"
    # echo "Working dir: $HELM_DIR ..." 
    chart_paths="$(cd "${HELM_DIR}"; find charts/ -mindepth 1 -maxdepth 1 -type d | sort)"
    for chart_path in $chart_paths; do # want charts/backstage and charts/orchestrator-infra 
        name=$(basename "$chart_path"); 
        echo -e "\n===========================\n[INFO] Publishing chart $name from $chart_path\n===========================\n"
        "$THIS_SCRIPT" \
            --chart-name "${name}" \
            --chart-dir "${chart_path}" \
            --chart-version "$CHART_VERSION" \
            --rhdh-version "$RHDH_VERSION" \
            --chart-branch "$CHART_BRANCH" \
            --publish \
            --extra-branch "$EXTRA_BRANCH" \
            --catalog "$CATALOG_FORK" \
            "$QUAY_REGISTRY_CONFIG" \
            ${DEBUG:+--debug}
        rc=$?
        if [[ $rc -ne 0 ]]; then
            echo "[ERROR] Failed to publish chart: $name (exit code $rc)"
            exit $rc
        fi
        echo -e "\n===========================\n[INFO] Chart $name published\n===========================\n"
    done
    echo; echo "[INFO] All charts published successfully."
    rm -fr "${HELM_DIR}"
    exit 0
fi

if [[ $DEBUG -eq 1 ]]; then
    echo "[DEBUG] Patching 'Chart.yaml', 'values.yaml', 'README.md.gotmpl' from branch ${CHART_BRANCH} ..."
fi

# TODO revise these to use jq wrapper version of yq (not mikefarah)
CHART_PATH="${HELM_DIR}/${CHART_DIR}/Chart.yaml"
VALUES_PATH="${HELM_DIR}/${CHART_DIR}/values.yaml"
CHART_ACTUAL_NAME=$($YQ '.name' "$CHART_PATH" | tr -d '"')
if [[ "$CHART_ACTUAL_NAME" == "redhat-developer-hub-orchestrator-infra" ]]; then
  echo "[INFO] Detected Orchestrator Infra chart"
  echo "[INFO] Preserving all upstream metadata and updating only version to ${CHART_VERSION}"
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
  $YQ eval ".version = \"$CHART_VERSION\"" --inplace "$TMP_CHART"
  $YQ eval ".name = \"redhat-developer-hub-orchestrator-infra\"" --inplace "$TMP_CHART"
  # Overwrite the original Chart.yaml
  mv "$TMP_CHART" "$CHART_PATH"
fi

if [[ "${CHART_NAME}" == "redhat-developer-hub" ]] || [[ "${CHART_NAME}" == "backstage" ]]; then
    echo "Set image digests in ${VALUES_PATH}:
* RHDH_DIGEST = $RHDH_DIGEST,
* POSTGRESQL_DIGEST = $POSTGRESQL_DIGEST"

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
    echo "[INFO] No patch to $VALUES_PATH required for ${CHART_NAME} - skip."
fi

TEST_TEMPLATE="${HELM_DIR}/${CHART_DIR}/templates/tests/test-connection.yaml"
if [[ -f "$TEST_TEMPLATE" ]]; then
    sed -e "s%quay.io/curl/curl:latest%registry.redhat.io/ubi9:latest%" -i "$TEST_TEMPLATE"
else
    echo "[INFO] No test-connection.yaml found for ${CHART_NAME}, skipping patch."
fi

# yq '.upstream.backstage.image , .upstream.postgresql.image' "${HELM_DIR}"/charts/backstage/values.yaml

if [[ "${CHART_NAME}" == "redhat-developer-hub" ]] || [[ "${CHART_NAME}" == "backstage" ]]; then
    cp "${SCRIPT_DIR}/README.md.gotmpl" "${HELM_DIR}/${CHART_DIR}/README.md.gotmpl"
fi
helm-docs --chart-search-root="${HELM_DIR}"/charts --template-files=./_templates.gotmpl --template-files=README.md.gotmpl --log-level="$HELM_DOCS_LOG_LEVEL"

if [[ $DEBUG -eq 1 ]]; then
    echo "[DEBUG] Building dependencies..."
fi
helm repo add --force-update bitnami https://charts.bitnami.com/bitnami 1>/dev/null
helm repo add --force-update backstage https://backstage.github.io/charts 1>/dev/null

if [[ $DEBUG -eq 1 ]]; then
    echo "[DEBUG] Building helm deps in ${HELM_DIR}/${CHART_DIR} ..."
fi
helm dependency build "${HELM_DIR}/${CHART_DIR}" 1>/dev/null

if [[ $DEBUG -eq 1 ]]; then
    echo "[DEBUG] Fetching Helm catalog into ${CATALOG_DIR} ..."
fi
git clone --filter=blob:none --no-checkout --depth=1 -q "${CATALOG_FORK}" "${CATALOG_DIR}" && cd "${CATALOG_DIR}"
git sparse-checkout init --cone
git read-tree -mu HEAD

rm -f "${CATALOG_DIR}/charts/redhat/redhat/${CHART_NAME}/${CHART_VERSION}/${CHART_NAME}-${CHART_VERSION}.tgz"
PACKAGE_DEST="${CATALOG_DIR}/charts/redhat/redhat/${CHART_NAME}/${CHART_VERSION}"
mkdir -p "$PACKAGE_DEST"
helm package "${HELM_DIR}/${CHART_DIR}" -d "$PACKAGE_DEST" 1>/dev/null
ls -lh "${PACKAGE_DEST}"
echo "Packaging chart to ${PACKAGE_DEST}"
helm package "${HELM_DIR}/${CHART_DIR}" -d "$PACKAGE_DEST"
if [[ $DEBUG -eq 1 ]]; then
    echo "Contents of ${HELM_DIR}/${CHART_DIR}:"
    ls -lh "${HELM_DIR}/${CHART_DIR}"
fi

git config --global user.email "rhdh-bot@redhat.com"
git config --global user.name "RHDH Build (rhdh-bot)"
git config --global push.default matching
git config --global pull.rebase false

mkdir "${CATALOG_DIR}"/installation -p

# Clean up remnants from old helm chart system used
rm -f "${CATALOG_DIR}"/installation/index.yaml

echo "
Chart version:        ${CHART_VERSION}"
if [[ $PUBLISH -eq 1 ]] && [[ $CHART_VERSION != *"CI"* ]]; then # include installation folder only for CI builds (not for GA)
    echo "Developer Hub image:  registry.redhat.io/rhdh/rhdh-hub-rhel9:${RHDH_VERSION}"
else
    echo "Developer Hub image:  quay.io/rhdh/rhdh-hub-rhel9:${RHDH_VERSION}"
fi
echo "Full repo folder:     $CATALOG_DIR"
echo "This chart's folder:  $PACKAGE_DEST"

if [[ $PUBLISH -eq 1 ]]; then
    helm_config="${PACKAGE_DEST}/chart_dump.json"
    actual_chart=$(find "${PACKAGE_DEST}/" -name "*.tgz")
    mv -f "$actual_chart" "${PACKAGE_DEST}/${CHART_NAME}-${CHART_VERSION}.tgz"
    if [[ ! -f "${PACKAGE_DEST}/${CHART_NAME}-${CHART_VERSION}.tgz" ]]; then 
        echo "[ERROR] Could not find chart in ${PACKAGE_DEST}/ called ${CHART_NAME}-${CHART_VERSION}.tgz ! Cannot continue - must exit!"; exit 1
    fi

    helm show chart "${PACKAGE_DEST}/${CHART_NAME}-${CHART_VERSION}.tgz" | $YQ -p yaml -o json > "${helm_config}"; # cat "${helm_config}"
    # we push to either quay.io/rhdh/chart or quay.io/rhdh/orchestrator-infra-chart
	if [[ "$CHART_NAME" == "redhat-developer-hub-orchestrator-infra" ]] || [[ "$CHART_NAME" == "orchestrator-infra" ]]; then
        TARGET_REPO="orchestrator-infra-chart"
    elif [[ "${CHART_NAME}" == "redhat-developer-hub" ]] || [[ "${CHART_NAME}" == "backstage" ]]; then
        TARGET_REPO="chart"
    else
        TARGET_REPO="${CHART_NAME}"
    fi
    # set -x 
    echo "[INFO] Publish Helm chart to quay.io/rhdh/${TARGET_REPO}:${CHART_VERSION} ..."
    oras push "quay.io/rhdh/${TARGET_REPO}:${CHART_VERSION}" \
        "${PACKAGE_DEST}/${CHART_NAME}-${CHART_VERSION}.tgz:application/vnd.cncf.helm.chart.content.v1.tar+gzip" \
        --disable-path-validation --config "${helm_config}:application/vnd.cncf.helm.config.v1+json" $QUAY_REGISTRY_CONFIG

    # remove any leftover tarballs from a previous run
    cd /tmp
    rm -fr *eveloper-hub-*.tgz

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
        rm -fr "/tmp/rhdh-bot-${CHART_VERSION}" /tmp/openshift-helm-charts-main
        git clone git@github.com:rhdh-bot/openshift-helm-charts.git -q --depth=1 -b "redhat-developer-hub-${CHART_VERSION}" "rhdh-bot-${CHART_VERSION}"
        git clone git@github.com:openshift-helm-charts/charts.git -q --depth=1 -b "main" "openshift-helm-charts-main"
        popd >/dev/null || exit 1

        # copy new tarball into other fork (excluding install instructions)
        pushd /tmp >/dev/null || exit 1
        rsync -aqrz \
        "rhdh-bot-${CHART_VERSION}/charts/redhat/redhat/${CHART_NAME}/${CHART_VERSION}/${CHART_NAME}-${CHART_VERSION}.tgz" \
        "openshift-helm-charts-main/charts/redhat/redhat/${CHART_NAME}/${CHART_VERSION}/"
        # create PR
        pushd "openshift-helm-charts-main/charts/redhat/redhat/${CHART_NAME}/" >/dev/null || exit 1
        git checkout main >/dev/null 2>&1 
        git pull origin main >/dev/null 2>&1 
        git pull origin >/dev/null 2>&1 
        git remote add rhdh-bot git@github.com:rhdh-bot/openshift-helm-charts.git
        git checkout origin/main -b "release-${CHART_VERSION}" >/dev/null 2>&1 || true
        git checkout "release-${CHART_VERSION}" >/dev/null 2>&1 || true
        git add "${CHART_VERSION}"
        COMMIT_MSG="chore: chart: add Red Hat Developer Hub ${CHART_VERSION} for registry.redhat.io/rhdh/rhdh-hub-rhel9:${RHDH_VERSION}"
        git commit --no-gpg-sign -s -m "${COMMIT_MSG}" "${CHART_VERSION}" .
        # delete branch (if exists)
        if [[ $(git ls-remote --heads git@github.com:rhdh-bot/openshift-helm-charts.git "refs/heads/release-${CHART_VERSION}") ]]; then
            git push rhdh-bot :release-"${CHART_VERSION}" || true
        fi
        # create new branch
        git push rhdh-bot release-"${CHART_VERSION}"

        # Option 1: open the PR creation page
        echo "Creating PR https://github.com/openshift-helm-charts/charts/compare/main...rhdh-bot:openshift-helm-charts:release-${CHART_VERSION}?expand=1 ..."

        # Option 2: create the PR automatically
        gh repo set-default openshift-helm-charts/charts
        gh pr create -t "${COMMIT_MSG}" -b "${COMMIT_MSG}" --base main --head rhdh-bot:openshift-helm-charts:release-"${CHART_VERSION}"
        # open new PR in a browser
        URL=$(gh pr view rhdh-bot:release-"${CHART_VERSION}" --json 'url' | jq -r '.url')
        google-chrome --incognito "$URL" || true
        popd >/dev/null || exit 1
        rm -fr "/tmp/rhdh-bot-${CHART_VERSION}" /tmp/openshift-helm-charts-main
        popd >/dev/null || exit 1
    elif [[ $EXTRA_BRANCH ]]; then # include installation folder only for CI builds (not for GA)
        git clone --filter=blob:none --no-checkout --depth=1 -q "${CATALOG_FORK}" "${CATALOG_DIR}-2" && \
            pushd "${CATALOG_DIR}-2" >/dev/null || exit 1
        git sparse-checkout init --cone
        git read-tree -mu HEAD
        git -C "${CATALOG_DIR}-2" checkout -q -b "${EXTRA_BRANCH}" >/dev/null 2>&1 || true
        git -C "${CATALOG_DIR}-2" pull $QUIET origin "${EXTRA_BRANCH}" >/dev/null 2>&1 || true
        rsync -arzq "${CATALOG_DIR}/installation" "${CATALOG_DIR}-2/"
        git -C "${CATALOG_DIR}-2" add installation --sparse
        CHANGED=1
        git -C "${CATALOG_DIR}-2" commit -q --no-verify --no-gpg-sign -s -m "chore: add redhat-developer-hub-${CHART_VERSION}" || CHANGED=0
        if [[ $CHANGED -eq 1 ]]; then
            git -C "${CATALOG_DIR}-2" push $QUIET origin "${EXTRA_BRANCH}" -f 2>/dev/null || \
                {
                    echo "[ERROR] Could not push to branch redhat-developer-hub-${CHART_VERSION}: must exit!"
                    exit 45
                }
        else
            # echo "nothing to commit, working tree clean"
            true
        fi
        popd >/dev/null || exit 1
        echo
        echo "Helm chart published. To install, see:
    https://github.com/rhdh-bot/openshift-helm-charts/tree/${EXTRA_BRANCH}/installation"
    fi

    if [[ $CHART_VERSION != *"CI"* ]] && [[ $DELETE_OLD_BRANCHES -eq 1 ]]; then
        # purge old CI branches, but keep the most recent one (sort -V | head -n -1)
        rm -fr "${CATALOG_DIR}"
        git clone -q "${CATALOG_FORK}" "${CATALOG_DIR}" >/dev/null 2>&1
        pushd "${CATALOG_DIR}" >/dev/null || exit 1
        # git remote -v
        # new branch name after April 9 2024
        for d in $(git branch -a | grep -E "remotes/.*/redhat-developer-hub" | grep "redhat-developer-hub-${RHDH_VERSION%-*}-" | grep CI | sed -r -e "s#.*remotes/[^/]+/##" | sort -V | head -n -1); do
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
else
    HELM_PROJECT="rhdh-${CHART_VERSION,,}"
    HELM_PROJECT="${HELM_PROJECT//./-}"
    echo ""
    echo "Flag '--publish' is not set. Changes are not pushed to '$CATALOG_FORK'. Instead they can be previewed in:

Full repo folder:     $CATALOG_DIR
This chart's folder:  $PACKAGE_DEST

To install this chart, run the following commands against your OCP cluster:

    oc new-project $HELM_PROJECT

    pushd $CATALOG_DIR/charts/redhat/redhat/redhat-developer-hub/${CHART_VERSION}/ >/dev/null; \\
        tar xzf ${CHART_NAME}-${CHART_VERSION}.tgz && \\
        helm upgrade redhat-developer-hub -i -n $HELM_PROJECT redhat-developer-hub/; \\
        PASSWORD=\$(kubectl get secret redhat-developer-hub-postgresql -o jsonpath=\"{.data.password}\" | base64 -d); \\
        CLUSTER_ROUTER_BASE=\$(oc get route console -n openshift-console -o=jsonpath='{.spec.host}' | sed 's/^[^.]*\.//'); \\
        helm upgrade redhat-developer-hub -n $HELM_PROJECT \\
        --set global.clusterRouterBase=\"\${CLUSTER_ROUTER_BASE}\" \\
        --set global.postgresql.auth.password=\"\$PASSWORD\" redhat-developer-hub/; \\
    popd >/dev/null
"
fi

deleteDirs() {
    BRANCH="$1"
    if [[ $DEBUG -eq 1 ]]; then
        echo "Clean up ${CATALOG_DIR}-3/charts/redhat/redhat/redhat-developer-hub/ in $BRANCH branch"
    fi
    # shellcheck disable=SC2044
    for olddir in $(
        find "${CATALOG_DIR}-3"/charts/redhat/redhat/redhat-developer-hub/ -maxdepth 1 -name "*-CI" || true
    ); do # echo $olddir
        if [[ $olddir != *"/${CHART_VERSION}" ]]; then
            git -C "${CATALOG_DIR}-3" rm -fr "$olddir" >/dev/null 2>&1 || true
            # echo "  Folder ${olddir##*redhat/redhat/} deleted"
        fi
    done
    git -C "${CATALOG_DIR}-3" commit -q --no-verify --no-gpg-sign -s -m "chore: clean redhat-developer-hub-${CHART_VERSION}" >/dev/null 2>&1 || true
    git -C "${CATALOG_DIR}-3" push $QUIET origin "$BRANCH" -f >/dev/null 2>&1 || true
    # find "${CATALOG_DIR}-3"/charts/redhat/redhat/redhat-developer-hub/ -maxdepth 1
}

# repo cleanup
if [[ $DEBUG -eq 1 ]]; then
    echo
    echo "Delete old folders from $EXTRA_BRANCH (except for $CHART_VERSION):"
fi
cd /tmp

# no need to do dir deletion in github repo now
# if [[ $EXTRA_BRANCH ]]; then
#     git clone --filter=blob:none -q "${CATALOG_FORK}" -b "${EXTRA_BRANCH}" "${CATALOG_DIR}-3" >/dev/null 2>&1
#     pushd "${CATALOG_DIR}-3" >/dev/null || exit 1
#         git -C "${CATALOG_DIR}-3" checkout "$EXTRA_BRANCH" >/dev/null 2>&1 || true
#         deleteDirs "$EXTRA_BRANCH"
#     popd >/dev/null || exit 1
# fi

# delete temp folders
rm -fr "${HELM_DIR}" "${CATALOG_DIR}" "${CATALOG_DIR}-2" # "${CATALOG_DIR}-3"
