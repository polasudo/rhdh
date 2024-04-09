#!/usr/bin/bash

RHDH_VERSION="" # Chart release version (used as 'version' in Chart.yaml)
CHART_VERSION="" # Developer Hub version (used as 'appVersion' in Chart.yaml and as image tag)
CATALOG_FORK="https://rhdh-bot:${GITHUB_TOKEN}@github.com/rhdh-bot/openshift-helm-charts.git" # Fork of "git@github.com:openshift-helm-charts/charts.git where you can push to
PUBLISH=0 # Set to True to push to CATALOG_FORK
CREATE_REPORT=0 # Set to True if you want to run https://github.com/redhat-certification/chart-verifier and create a report

EXTRA_BRANCH="" # another branch to force push, eg., rhdh-1.2-rhel-9
DEBUG=0
QUIET="-q"

# TODO switch to jq wrapper version of yq (not mikefarah)
mikefarahyq_version="4.35.2"
helmdocs_version="v1.11.3"
# Exit when any command fails
set -e

usage ()
{
    echo "Usage: $0 --chart-version x.y.z --rhdh-version x.y-zzz --rev N [--catalog <git-url>] [--debug] [--publish] 

NOTE: This must be run using the GITHUB_TOKEN of rhdh-bot@redhat.com in order to push to that user's fork.

Options:
    --latest, --next          Compute the most recent tag (by semver sort rules) in quay.io/rhdh/rhdh-hub-rhel9, and use that tag in chart
    --publish                 Push the changes to branch developer-hub-\${CHART_VERSION} of the repository specified by --catalog
    --extra-branch            Push changes to an extra branch, such as rhdh-1.1-rhel-9
    --create-report           Create a report via https://github.com/redhat-certification/chart-verifier.
                              [IMPORTANT!] Requires local user to be logged into an OCP cluster
    --catalog                 If publish is set, this needs to point to a fork of
                              git@github.com:openshift-helm-charts/charts.git with write access
    --chart-version           Chart release version (used as 'version' in Chart.yaml)
    --rhdh-version            Developer Hub version (used as 'appVersion' in Chart.yaml and as image tag)
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
    $ TAG=1.1-zzz; $0 --chart-version \${TAG}-CI --rhdh-version \${TAG} --extra-branch rhdh-1.1-rhel-9 \\
        --catalog git@github.com:rhdh-bot/openshift-helm-charts.git --publish
    Chart version:        1.1-zzz-CI
    Developer Hub image:  quay.io/rhdh/rhdh-hub-rhel9:1.1-zzz

    # Or, log into the quay.io/rhdh/ org, then compute the latest or next 1.1-zzz tag
    $ export GITHUB_TOKEN=ghp_rhdh-bot-token-here
    $ $0 --latest --publish 
    $ $0 --next --publish 
    Chart version:        1.1-zzz-CI
    Developer Hub image:  quay.io/rhdh/rhdh-hub-rhel9:1.1-zzz

    # Run this manually on GA release day
    # 1. use gh to log in as the bot (use incognito browser so you don't have to log out as yourself)
    $ export GITHUB_TOKEN=
    $ gh auth login -h github.com
        ? You're already logged into github.com. Do you want to re-authenticate? Yes
        ? What is your preferred protocol for Git operations? HTTPS
        ? How would you like to authenticate GitHub CLI? Login with a web browser
        ! First copy your one-time code: F00D-CAFE
        Press Enter to open github.com in your browser... 
        Opening in existing browser session.
        ✓ Authentication complete.
        - gh config set -h github.com git_protocol https
        ✓ Configured git protocol
        ✓ Logged in as rhdh-bot
    # 2. Run a manual release as the bot:
    $ export GITHUB_TOKEN=ghp_rhdh-bot-token-here
    $ $0 --chart-version 1.0.0 --rhdh-version 1.0-200 --catalog git@github.com:rhdh-bot/openshift-helm-charts.git --publish
    Chart version:        1.0.0
    Developer Hub image:  quay.io/rhdh/rhdh-hub-rhel9:1.0-200
"
    exit
}

# Commandline args
while [[ "$#" -gt 0 ]]; do
  case $1 in
    # TODO should this actually grab the appropriate branch?
    '--next'|'--latest') 
        next_tag=$(skopeo inspect docker://quay.io/rhdh/rhdh-hub-rhel9:latest | jq -r '.RepoTags[]' | grep -v -E "next|latest" | grep -- "-" | sort -uV | tail -1 || true)
        CHART_VERSION=${next_tag}-CI
        RHDH_VERSION=${next_tag}
        echo "Create chart for $next_tag";;
    '--extra-branch') EXTRA_BRANCH="$2"; shift 1;;
    '--publish') PUBLISH=1;;
    '--catalog') CATALOG_FORK="$2"; shift 1;;
    '--chart-version') CHART_VERSION="$2"; shift 1;;
    '--rhdh-version') RHDH_VERSION="$2"; shift 1;;
    '--create-report') CREATE_REPORT=1;;
    '--debug') DEBUG=1; QUIET="";;
    '--help') usage;;
  esac
  shift 1
done

if [[ ! $RHDH_VERSION ]]; then usage; fi

HELM_DIR=$(mktemp -d)
if [[ $DEBUG -eq 1 ]]; then echo "Running in HELM_DIR = $HELM_DIR"; fi
HELM_SOURCE_REF="main"
CATALOG_DIR=$(mktemp -d)
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
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

if ! command -v gh &> /dev/null; then
    ghclirepo=https://cli.github.com/packages/rpm/gh-cli.repo
    echo "Intalling gh from $ghclirepo ..." 
    sudo dnf config-manager --add-repo $ghclirepo -q && sudo dnf -y -q install gh 
fi
if ! command -v helm &> /dev/null; then
    helmrpmrepo="https://rhsm-pulp.corp.redhat.com/content/dist/layered/rhel8/x86_64/ocp-tools/4.12/os/"
    echo "Installing helm from $helmrpmrepo ..."
    sudo dnf config-manager --add-repo $helmrpmrepo -q && sudo dnf -y -q install helm
fi
if ! command -v helm-docs &> /dev/null; then
    helmdocrepo=github.com/norwoodj/helm-docs/cmd/helm-docs@${helmdocs_version}
    echo "Installing $helmdocrepo to ${HOME}/go/bin/helm-docs ..."
    sudo dnf -y -q install brotli-devel cmake gcc gcc-c++ git golang
    GO111MODULE=on go install $helmdocrepo
    export PATH="$PATH:${HOME}/go/bin"
fi
if ! command -v oc &> /dev/null; then
    ocrpmrepo="https://rhsm-pulp.corp.redhat.com/content/dist/layered/rhel8/x86_64/rhocp/4.12/os/"
    echo "Installing oc from $ocrpmrepo ..."
    sudo dnf config-manager --add-repo $ocrpmrepo -q && sudo dnf -y -q install openshift-clients
fi
if ! command -v podman &> /dev/null; then
    ocrpmrepo="https://rhsm-pulp.corp.redhat.com/content/dist/layered/rhel8/x86_64/rhocp/4.12/os/"
    echo "Installing podman from $ocrpmrepo ..."
    sudo dnf config-manager --add-repo $ocrpmrepo -q && sudo dnf -y -q install podman
fi
# TODO switch to jq wrapper version of yq (not mikefarah)
if ! command -v $YQ &> /dev/null; then
    echo "Installing mikefarah yq version $mikefarahyq_version ..."
    curl -sSLo $YQ https://github.com/mikefarah/yq/releases/download/v${mikefarahyq_version}/yq_linux_amd64 && chmod +x $YQ
fi

for c in gh git helm helm-docs oc podman $YQ; do
    if ! command -v $c &> /dev/null; then
        echo "Command not found: '$c'"
        usage
    fi
done

if [[ $DEBUG -eq 1 ]]; then
    HELM_DOCS_LOG_LEVEL="warning"
    echo "Fetching Janus-IDP chart..."
fi
# skip binaries with --filter=blob:none
git clone --depth=1 -q --branch=${HELM_SOURCE_REF} https://github.com/redhat-developer/rhdh-chart.git "${HELM_DIR}"

if [[ $DEBUG -eq 1 ]]; then
    echo "Patching 'Chart.yaml', 'values.yaml', 'README.md.gotmpl'..."
fi

# TODO revise these to use jq wrapper version of yq (not mikefarah)
if [[ $CHART_VERSION == *"CI"* ]]; then
    if [[ $DEBUG -eq 1 ]]; then
        echo "Apply (CI Build) suffix to chart name"
    fi
    $YQ -i "
        . *= load(\"${SCRIPT_DIR}/Chart_patch.yaml\") |
        .version=\"${CHART_VERSION}\" |
        .appVersion=\"${RHDH_VERSION}\" |
        .annotations.\"charts.openshift.io/name\"=\"Red Hat Developer Hub (CI Build)\" |
        .description=\"A Helm chart for deploying Red Hat Developer Hub (CI Build)\"
    " "${HELM_DIR}"/charts/backstage/Chart.yaml
else
    $YQ -i "
        . *= load(\"${SCRIPT_DIR}/Chart_patch.yaml\") |
        .version=\"${CHART_VERSION}\" |
        .appVersion=\"${RHDH_VERSION}\"
    " "${HELM_DIR}"/charts/backstage/Chart.yaml
fi

$YQ -i "
    . *= load(\"${SCRIPT_DIR}/values_patch.yaml\") |
    .upstream.backstage.image.tag=\"${RHDH_VERSION}\"
" "${HELM_DIR}"/charts/backstage/values.yaml

if [[ $CHART_VERSION == *"CI"* ]]; then 
    # echo "Using quay.io for CI build"
    $YQ -i "
    . *= load(\"${SCRIPT_DIR}/values_patch.yaml\") |
    .upstream.backstage.image.registry=\"quay.io\"
" "${HELM_DIR}"/charts/backstage/values.yaml
fi

# Replace uncertified curl image with ubi9 in the test template (the file is not a valid yaml for yq)
sed -e "s%quay.io/curl/curl:latest%registry.redhat.io/ubi9:latest%" -i "${HELM_DIR}"/charts/backstage/templates/tests/test-connection.yaml

cp "${SCRIPT_DIR}/README.md.gotmpl" "${HELM_DIR}/charts/backstage/README.md.gotmpl"
helm-docs --chart-search-root="${HELM_DIR}"/charts --template-files=./_templates.gotmpl --template-files=README.md.gotmpl --log-level="$HELM_DOCS_LOG_LEVEL"

if [[ $DEBUG -eq 1 ]]; then
    echo "Building dependencies..."
fi
helm repo add --force-update bitnami https://charts.bitnami.com/bitnami 1>/dev/null
helm repo add --force-update backstage https://backstage.github.io/charts 1>/dev/null

if [[ $DEBUG -eq 1 ]]; then
    echo "Building helm deps in ${HELM_DIR}/charts/backstage ..."
fi
helm dependency build "${HELM_DIR}"/charts/backstage 1>/dev/null

if [[ $DEBUG -eq 1 ]]; then
    echo "Fetching Helm catalog into ${CATALOG_DIR} ..."
fi
git clone --filter=blob:none --no-checkout --depth=1 -q "${CATALOG_FORK}" "${CATALOG_DIR}" && cd "${CATALOG_DIR}"
git sparse-checkout init --cone
git read-tree -mu HEAD

if [[ $DEBUG -eq 1 ]]; then
    echo "Publishing chart into the catalog..."
fi
git -C "${CATALOG_DIR}" checkout -q -b developer-hub-"${CHART_VERSION}" 1>/dev/null 2>&1 
git -C "${CATALOG_DIR}" pull $QUIET origin developer-hub-"${CHART_VERSION}" 1>/dev/null 2>&1 || true
mkdir -p "${CATALOG_DIR}"/charts/redhat/redhat/redhat-developer-hub/"${CHART_VERSION}"
git -C "${CATALOG_DIR}" rm -f "${CATALOG_DIR}"/charts/redhat/redhat/redhat-developer-hub/"${CHART_VERSION}"/*eveloper-hub-"${CHART_VERSION}".tgz 1>/dev/null 2>&1 || true
helm package "${HELM_DIR}"/charts/backstage -d "${CATALOG_DIR}"/charts/redhat/redhat/redhat-developer-hub/"${CHART_VERSION}" 1>/dev/null
git -C "${CATALOG_DIR}" add -f "${CATALOG_DIR}"/charts/redhat/redhat/redhat-developer-hub/"${CHART_VERSION}"/redhat-developer-hub-"${CHART_VERSION}".tgz --sparse 1>/dev/null

if [[ $CREATE_REPORT -eq 1 ]]; then
    if [[ $DEBUG -eq 1 ]]; then
        echo "Creating a report.yaml via chart-verifier..."
    fi

    # Check if it can connect to test cluster and the required pull secret exists.
    oc get secrets/rhdh-pull-secret >/dev/null

    podman run --rm -i --platform=linux/amd64 \
        -e KUBECONFIG=/.kube/config \
        -v "${HOME}/.kube":/.kube \
        -v "${CATALOG_DIR}"/charts/redhat/redhat/redhat-developer-hub/"${CHART_VERSION}":/mnt/chart \
        "quay.io/redhat-certification/chart-verifier" \
        verify --set profile.vendorType=redhat /mnt/chart/redhat-developer-hub-"${CHART_VERSION}".tgz > "${CATALOG_DIR}"/charts/redhat/redhat/redhat-developer-hub/"${CHART_VERSION}"/report.yaml
    git -C "${CATALOG_DIR}" add -f "${CATALOG_DIR}"/charts/redhat/redhat/redhat-developer-hub/"${CHART_VERSION}"/report.yaml --sparse 1>/dev/null
fi

git config --global user.email "rhdh-bot@redhat.com"
git config --global user.name "RHDH Build (rhdh-bot)"
git config --global push.default matching
git config --global pull.rebase false

mkdir "${CATALOG_DIR}"/installation -p
git -C "${CATALOG_DIR}" add -f "${CATALOG_DIR}"/installation/ --sparse 1>/dev/null

# generate index
git -C "${CATALOG_DIR}" rm -f "${CATALOG_DIR}"/installation/index.yaml 1>/dev/null 2>&1 || true
helm repo index "${CATALOG_DIR}/installation"
git -C "${CATALOG_DIR}" commit -q --no-verify --no-gpg-sign -s -m "chore: add developer-hub-${CHART_VERSION}" || exit 55

echo "
Chart version:        ${CHART_VERSION}
"
if [[ $PUBLISH -eq 1 ]] && [[ $CHART_VERSION != *"CI"* ]]; then # include installation folder only for CI builds (not for GA)
    echo "Developer Hub image:  registry.redhat.io/rhdh/rhdh-hub-rhel9:${RHDH_VERSION}
"
else
    echo "Developer Hub image:  quay.io/rhdh/rhdh-hub-rhel9:${RHDH_VERSION}
"
fi
echo "
Branch:               https://github.com/rhdh-bot/openshift-helm-charts/tree/developer-hub-${CHART_VERSION}
Full repo folder:     $CATALOG_DIR
This chart's folder:  $CATALOG_DIR/charts/redhat/redhat/redhat-developer-hub/${CHART_VERSION}/
"

if [[ $PUBLISH -eq 1 ]]; then
    git -C "${CATALOG_DIR}" pull $QUIET origin developer-hub-"${CHART_VERSION}" 1>/dev/null 2>&1 || true
    git -C "${CATALOG_DIR}" push $QUIET origin developer-hub-"${CHART_VERSION}" -f 2>/dev/null || \
        { echo "[ERROR] Could not push to branch developer-hub-${CHART_VERSION}: must exit!"; exit 44; } 

    # remove any leftover tarballs from a previous run
    cd /tmp; rm -fr *eveloper-hub-*.tgz
    # fetch the new tarball
    curl -sS -O    "https://raw.githubusercontent.com/rhdh-bot/openshift-helm-charts/developer-hub-$CHART_VERSION/charts/redhat/redhat/redhat-developer-hub/$CHART_VERSION/redhat-developer-hub-$CHART_VERSION.tgz"
    # create a helmchart repo from that single tarball
    helm repo index . --url "https://raw.githubusercontent.com/rhdh-bot/openshift-helm-charts/developer-hub-$CHART_VERSION/charts/redhat/redhat/redhat-developer-hub/$CHART_VERSION/"
    # push change to installation folder of the developer-hub-"${CHART_VERSION}" branch 
    mv index.yaml "${CATALOG_DIR}"/installation/

    # update installation/README.md and installation/rhdh-next-ci-repo.yaml, expanding variables
    export CHART_VERSION="${CHART_VERSION}"
    CHART_VERSION_OCP=$(echo "$CHART_VERSION" | tr "." "-" | tr "[:upper:]" "[:lower:]")
    export CHART_VERSION_OCP="${CHART_VERSION_OCP}"
    envsubst < "${SCRIPT_DIR}/installation/README.tmpl.md" > "${CATALOG_DIR}"/installation/README.md
    envsubst < "${SCRIPT_DIR}/installation/rhdh-next-ci-repo.tmpl.yaml" > "${CATALOG_DIR}"/installation/rhdh-next-ci-repo.yaml

    # include installation script
    cp "${SCRIPT_DIR}/install.sh" "${CATALOG_DIR}"/installation/install.sh

    # force push new files to the developer-hub-"${CHART_VERSION}" branch

    if [[ $CHART_VERSION == *"CI"* ]]; then # include installation folder only for CI builds (not for GA)
        git -C "${CATALOG_DIR}" add installation --sparse
        git -C "${CATALOG_DIR}" commit -q --no-verify --no-gpg-sign -s -m "chore: add developer-hub-${CHART_VERSION}" || exit 55
        git -C "${CATALOG_DIR}" push $QUIET origin developer-hub-"${CHART_VERSION}" -f 2>/dev/null || \
            { echo "[ERROR] Could not push to branch developer-hub-${CHART_VERSION}: must exit!"; exit 44; }

        if [[ $EXTRA_BRANCH ]]; then # force push to the rhdh-1.y-rhel-9 branch so we have a branch that changes over time
            git clone --filter=blob:none --no-checkout --depth=1 -q "${CATALOG_FORK}" "${CATALOG_DIR}-2" && cd "${CATALOG_DIR}-2"
            git sparse-checkout init --cone
            git read-tree -mu HEAD
            git -C "${CATALOG_DIR}-2" checkout -q -b "${EXTRA_BRANCH}" 1>/dev/null 2>&1 || true
            git -C "${CATALOG_DIR}-2" pull $QUIET origin "${EXTRA_BRANCH}" 1>/dev/null 2>&1 || true
            rsync -arzq "${CATALOG_DIR}/installation" "${CATALOG_DIR}/charts" "${CATALOG_DIR}-2/"
            git -C "${CATALOG_DIR}-2" add installation charts --sparse
            git -C "${CATALOG_DIR}-2" commit -q --no-verify --no-gpg-sign -s -m "chore: add developer-hub-${CHART_VERSION}" || exit 55
            git -C "${CATALOG_DIR}-2" push $QUIET origin "${EXTRA_BRANCH}" -f 2>/dev/null || \
                { echo "[ERROR] Could not push to branch developer-hub-${CHART_VERSION}: must exit!"; exit 45; }
        fi
        echo; echo "Helm chart published. To install, see:
    https://github.com/rhdh-bot/openshift-helm-charts/tree/developer-hub-${CHART_VERSION}/installation"
        if [[ $EXTRA_BRANCH ]]; then # force push to the rhdh-1.y-rhel-9 branch so we have a branch that changes over time
            echo "    https://github.com/rhdh-bot/openshift-helm-charts/tree/${EXTRA_BRANCH}/installation"
        fi
    else
        # create a PR against the openshift-helm-charts/charts repo, containing ONLY the tarball,
        # none of the installation instructions/scripts/chart repo
        pushd /tmp >/dev/null || exit 1
        rm -fr "/tmp/rhdh-bot-${CHART_VERSION}" /tmp/openshift-helm-charts-main
        git clone git@github.com:rhdh-bot/openshift-helm-charts.git -q --depth=1 -b "developer-hub-${CHART_VERSION}" "rhdh-bot-${CHART_VERSION}"
        git clone git@github.com:openshift-helm-charts/charts.git   -q --depth=1 -b "main" "openshift-helm-charts-main"
        popd >/dev/null || exit 1

        # copy new tarball into other fork (excluding install instructions)
        pushd /tmp >/dev/null || exit 1
        rsync -aqrz \
            "rhdh-bot-${CHART_VERSION}/charts/redhat/redhat/redhat-developer-hub/${CHART_VERSION}/redhat-developer-hub-${CHART_VERSION}.tgz" \
            "openshift-helm-charts-main/charts/redhat/redhat/redhat-developer-hub/${CHART_VERSION}/"

        # create PR
        pushd openshift-helm-charts-main/charts/redhat/redhat/redhat-developer-hub/ >/dev/null || exit 1
        git checkout main
        git pull origin main
        git pull origin
        git remote add rhdh-bot git@github.com:rhdh-bot/openshift-helm-charts.git
        git checkout origin/main -b "release-${CHART_VERSION}" || true
        git checkout "release-${CHART_VERSION}" || true
        git add "${CHART_VERSION}"
        git commit --no-gpg-sign -s -m "chore: chart: add Red Hat Developer ${CHART_VERSION}" "${CHART_VERSION}"
        git pull rhdh-bot release-"${CHART_VERSION}" || true
        git push rhdh-bot release-"${CHART_VERSION}"
        hub pull-request -o -f -m "chore: chart: add RHDH ${CHART_VERSION}

        chore: chart: add Red Hat Developer ${CHART_VERSION}

        Signed-off-by: RHDH Bot <rhdh-bot@redhat.com>" -b openshift-helm-charts:main -h rhdh-bot:release-"${CHART_VERSION}"
        popd >/dev/null || exit 1
        rm -fr "/tmp/rhdh-bot-${CHART_VERSION}" /tmp/openshift-helm-charts-main
        popd >/dev/null || exit 1
    fi

    if [[ $CHART_VERSION != *"CI"* ]]; then
        # purge old CI branches, but keep the most recent one (head -n -1)
        rm -fr "${CATALOG_DIR}"; git clone -q "${CATALOG_FORK}" "${CATALOG_DIR}"
        pushd "${CATALOG_DIR}" >/dev/null || exit 1
            # git remote -v
            for d in $(git branch -a | grep -E "remotes/origin/developer-hub" | grep "developer-hub-${RHDH_VERSION%-*}-" | grep CI | sed -r -e "s#.*remotes/origin/##" | sort | head -n -1); do 
                git push origin ":${d}" 2>/dev/null
                echo "Branch $d deleted"
            done
        popd >/dev/null || exit 1

    fi
else
    echo ""
    echo "Flag '--publish' is not set. Changes are not pushed to '$CATALOG_FORK'. Instead they can be previewed in:

Full repo folder:     $CATALOG_DIR
This chart's folder:  $CATALOG_DIR/charts/redhat/redhat/redhat-developer-hub/${CHART_VERSION}/

To install this chart, run the following commands against your OCP cluster:

    cd $CATALOG_DIR/charts/redhat/redhat/redhat-developer-hub/${CHART_VERSION}/; \
    tar xzf redhat-developer-hub-${CHART_VERSION}.tgz && \
    helm install -n <your-rhdh-project> --generate-name developer-hub/
"
fi

# repo cleanup
if [[ $DEBUG -eq 1 ]]; then
    echo;echo "Delete old folders from branches developer-hub-${CHART_VERSION} and $EXTRA_BRANCH (except for $CHART_VERSION):"
fi
git clone --filter=blob:none -q "${CATALOG_FORK}" -b "developer-hub-${CHART_VERSION}" "${CATALOG_DIR}-3" 1>/dev/null 2>&1 && cd "${CATALOG_DIR}-3"

deleteDirs() {
    BRANCH="$1"
    if [[ $DEBUG -eq 1 ]]; then
        echo "Clean up ${CATALOG_DIR}-3/charts/redhat/redhat/redhat-developer-hub/ in $BRANCH branch"
    fi
    # shellcheck disable=SC2044
    for olddir in $(find "${CATALOG_DIR}-3"/charts/redhat/redhat/redhat-developer-hub/ -maxdepth 1 -name "0.*" -o -name "*-CI"); do # echo $olddir
        if [[ $olddir != *"/${CHART_VERSION}" ]]; then
            git -C "${CATALOG_DIR}-3" rm -fr "$olddir" 1>/dev/null 2>&1 || true
            # echo "  Folder ${olddir##*redhat/redhat/} deleted"
        fi
    done
    git -C "${CATALOG_DIR}-3" commit -q --no-verify --no-gpg-sign -s -m "chore: clean developer-hub-${CHART_VERSION}" 1>/dev/null 2>&1 || true
    git -C "${CATALOG_DIR}-3" push $QUIET origin "$BRANCH" -f 1>/dev/null 2>&1 || true
    # find "${CATALOG_DIR}-3"/charts/redhat/redhat/redhat-developer-hub/ -maxdepth 1
}

deleteDirs developer-hub-"${CHART_VERSION}"
if [[ $EXTRA_BRANCH ]]; then
    git -C "${CATALOG_DIR}-3" checkout "$EXTRA_BRANCH" 1>/dev/null 2>&1 || true
    deleteDirs "$EXTRA_BRANCH"
fi

rm -fr "${HELM_DIR}" "${CATALOG_DIR}" "${CATALOG_DIR}-2" "${CATALOG_DIR}-3"
