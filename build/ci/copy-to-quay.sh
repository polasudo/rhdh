#!/bin/bash
#
# Copyright (c) 2023 Red Hat, Inc.
# 
# called by .gitlab-ci.yml

# set -x
set -e

usage() {
  echo "
Usage:
Options:
    -v DH_VERSION       version of Developer Hub to publish; default: $DH_VERSION
    -h                  this help

Example:

    $0 -v 1.2
"
  exit 0
}

while [[ "$#" -gt 0 ]]; do
  case $1 in
  '-v')
    DH_VERSION="$2"
    shift 2
    ;;
  '-h' | '--help')
    usage
    ;;
  *)
    echo "[ERROR] Invalid parameter: $1"
    echo
    usage
    ;;
  esac
done

# shellcheck disable=SC2154
echo "builds_dir = $builds_dir
CI_BUILDS_DIR = $CI_BUILDS_DIR
CI_PROJECT_DIR = $CI_PROJECT_DIR
CI_PROJECT_PATH = $CI_PROJECT_PATH
CI_PROJECT_NAMESPACE = $CI_PROJECT_NAMESPACE
CI_PROJECT_NAME = $CI_PROJECT_NAME
CI_PROJECT_ID = $CI_PROJECT_ID
CI_JOB_TOKEN = $CI_JOB_TOKEN
CI_API_V4_URL = $CI_API_V4_URL"

cd /tmp
curl -sSLkO https://hdn.corp.redhat.com/rhel7-csb-stage/RPMS/noarch/redhat-internal-cert-install-0.1-31.el7.noarch.rpm
dnf -y -q update
dnf -y -q install sudo docker podman skopeo openssl openssl-devel python3-pip git jq rsync redhat-internal-cert-install*.rpm && rm -f redhat-internal-cert-install*.rpm
pip3 install -q yq

# installed binaries and default locations
for r in yq jq; do echo -n "$(which $r) : "; $r --version; done

# add ~/.ssh/known_hosts entry for gitlab.cee.redhat.com
cat << EOT >> ~/.ssh/known_hosts
gitlab.cee.redhat.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICBgflBIyju1LV/29PmFDw0GLdB9h0JUXglNrvWjBQ2u 
gitlab.cee.redhat.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDXAc+2x0Z5jMxGVk1J6rN5e1a1hA0L/xLrZMV8iAJmDU/QjlaCcFduF73TzUQnAQu55jpmx4WmBizkz5YqR5SIiJy9y4GXXpup6YKXketFVGJinphl66LMCKWH2nRmdJbe6nzNac8nS6ZKb2X9Oc3NbxgEQMtY5Q2bzPkEiOf4Etp3MInbi9AAJsdkRC9yKhrQcHAniBO5Ugkk6XtxuzW/TdismBto2JZoarsGAuBe4oVOXwfo6arbVE6P8HGH0XShwzFLkm1E92eckeE2/93PDYWm1vteJv5VT8Gr0acEkPX93TpqwL5MqKbbco7pFStuDe5SrJ4i36KV/aCl4Ixz
gitlab.cee.redhat.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBNJJ7oW5YthSOORuIael9+pvEwkGc0VZxLlqvufzjYk09JV82f+UZRcsjud2cPUSogvgmGGtLKqmwLLeKhe6xgc=
EOT

pushd "${CI_PROJECT_DIR}/" >/dev/null || exit 1

# git config user.email "${GITLAB_USER_EMAIL}"
# git config user.name "RHDH Build ($GITLAB_USER_LOGIN)"
git config user.email "rhdh-bot@redhat.com"
git config user.name "RHDH Build (rhdh-bot)"
git config --global push.default matching
git config --global merge.ff true
git config --global pull.ff-only true
git config --global pull.rebase true
git config --global branch.autosetupmerge true
git config --global branch.autosetuprebase always

git config --global advice.skippedCherryPicks false
git config --global advice.detachedHead false
# git config --global init.defaultBranch main

#git checkout -- .; git reset HEAD .; git clean -fdx
git fetch --all
git branch
git checkout "${CI_COMMIT_BRANCH}" || exit 1
git rev-parse --abbrev-ref HEAD

# build and install download-secure-files from sources
DSF_TAG="v0.1.9"
dnf -y -q install golang make cmake openssl openssl-devel gcc gcc-c++ git
pushd /tmp >/dev/null || exit 1
rm -fr download-secure-files/
git clone https://gitlab.com/gitlab-org/incubation-engineering/mobile-devops/download-secure-files.git && cd download-secure-files/
git checkout $DSF_TAG
echo "download-secure-files version: $(cat VERSION)"
go get; CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-X 'main.Version=$(cat VERSION)'"  -o "$HOME/bin/download-secure-files" download-secure-files
# go test -v
chmod +x "$HOME/bin/download-secure-files"
rm -fr /tmp/download-secure-files
popd >/dev/null || exit 1
# try several times because it seems to work less than half the time...
for d in {1..90}; do 
    failed=0
    echo -n "[$d] "; /root/bin/download-secure-files || failed=1
    if [[ $failed -eq 0 ]]; then 
        break
    else
        echo " download-secure-files failed [$d]; sleep and try again..."
    fi
    sleep 2
done

# quay token (rhdh_bot_quay.token) uploaded to Secure Files, see https://gitlab.cee.redhat.com/rhidp/rhdh/-/settings/ci_cd
# see https://quay.io/organization/rhdh?tab=robots to regen token
if [[ -f "${CI_PROJECT_DIR}/.secure_files/rhdh_bot_quay.token" ]]; then
    set +x
    # NOTE that if debugging with set -x, files will be revealed in plaintext, not obfuscated
    QUAY_TOKEN=$(grep -E -v "^#" "${CI_PROJECT_DIR}/.secure_files/rhdh_bot_quay.token")
    RRIO_USERNAME=$(grep -E -v "^#" "${CI_PROJECT_DIR}/.secure_files/rhdh_bot_registry_redhat_io.user")
    RRIO_PASSWORD=$(grep -E -v "^#" "${CI_PROJECT_DIR}/.secure_files/rhdh_bot_registry_redhat_io.pwd")
    # set -x
    rm -fr "${CI_PROJECT_DIR}/.secure_files"
else
    echo "Error: could not load ${CI_PROJECT_DIR}/.secure_files/; must exit!"
    exit 69
fi

# set a shared location for the podman/skopeo authentication
export REGISTRY_AUTH_FILE=/run/containers/0/auth.json

# login to quay.io
set +x
REGISTRY="quay.io"
QUAY_USER="rhdh+rhdh_bot"
echo -n "[INFO]: Log into $REGISTRY ... "
echo "${QUAY_TOKEN}" | skopeo login -u="${QUAY_USER}" --password-stdin ${REGISTRY} -v --authfile $REGISTRY_AUTH_FILE

# login to registry.redhat.io
REGISTRY="registry.redhat.io"
set +x
echo -n "[INFO]: Log into $REGISTRY ... "
echo "${RRIO_PASSWORD}" | skopeo login -u="${RRIO_USERNAME}" --password-stdin ${REGISTRY} -v --authfile $REGISTRY_AUTH_FILE

mkdir -p "$HOME/.docker"; cp $REGISTRY_AUTH_FILE "$HOME/.docker/config.json"

# copy new containers to quay; generate IIBs and push to quay
echo "===== Copy OSBS images to Quay ===========>"

# use :latest for a stable branch like rhdh-1.1-, and :next for rhdh-1- branch
set -x
MIDSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")
if [[ ${MIDSTM_BRANCH} != "rhdh-"*"-rhel-"* ]]; then MIDSTM_BRANCH="rhdh-1-rhel-9"; fi
latestNext="latest"; if [[ $MIDSTM_BRANCH == "rhdh-1-rhel-9" ]]; then latestNext="next"; fi

if [[ ! $DH_VERSION ]] && [[ -f distgit/containers/rhdh-hub/package.json ]]; then
    DH_VERSION=$(yq -r '.version' distgit/containers/rhdh-hub/package.json); DH_VERSION=${DH_VERSION%.*} # 1.2
fi
set +x

./build/scripts/getLatestImageTags.sh -b ${MIDSTM_BRANCH} --osbs --pushtoquay="${DH_VERSION} $latestNext"

echo "===== Quay images ===========>" | tee -a /tmp/copy-to-quay.sh.result.txt
./build/scripts/getLatestImageTags.sh -b ${MIDSTM_BRANCH} --quay --tag "${DH_VERSION}-" --hide | tee -a /tmp/copy-to-quay.sh.result.txt

echo "===== NVRs (requires brewkoji) ===========>" | tee -a /tmp/copy-to-quay.sh.result.txt
cat <<EOF > /etc/yum.repos.d/latest-RCMTOOLS-2-RHEL-9.repo
[latest-RCMTOOLS-2-RHEL-9]
name=latest-RCMTOOLS-2-RHEL-9
baseurl=https://download.devel.redhat.com/rel-eng/RCMTOOLS/latest-RCMTOOLS-2-RHEL-9/compose/BaseOS/\$basearch/os/
enabled=1
gpgcheck=0
skip_if_unavailable=True
EOF
dnf -y -q install brewkoji || true
./build/scripts/getLatestImageTags.sh -b rhdh-${DH_VERSION}-rhel-9 --nvr | tee -a /tmp/copy-to-quay.sh.result.txt || true

echo "===== Quay IIBs (requires kaniko) ===========>" | tee -a /tmp/copy-to-quay.sh.result.txt
# check if IIBs exist for the latest bundle

checkIIBExists()
{
    count=0
    interval=4 # check every x mins
    max_count=120 # stop checking after y mins
    while [[ $count -le $max_count ]]; do # echo $count
        echo "[INFO] [$count/$max_count mins] Check for latest IIBs @ $(date +%H:%M:%S) ..." 
        # check if the IIB exists
        refUrlCheck=$(./build/scripts/getIIBsForBundle.sh -t ${DH_VERSION} || true)
        if [[ -z ${refUrlCheck} ]] || \
          [[ ${refUrlCheck} == *"ERROR"* ]] || \
          [[ ${refUrlCheck} == *"not fetch ref_url from"* ]] || \
          [[ ${refUrlCheck} == *"not read index_images.yml from"* ]]; then
            echo "$refUrlCheck"
            echo "[WARN] Cannot push new IIBs until they exist. Sleeping for $interval ..."
          (( count=count+interval ))
          sleep ${interval}m
          refUrlCheck=""
        elif [[ ${refUrlCheck} ]]; then
            echo "[INFO] Latest IIBs:"
            echo "${refUrlCheck}"
            echo
            # to replace existing quay images, use --force flag
            ./build/scripts/copyIIBsToQuay.sh --push --kaniko --no-validate --authfile $REGISTRY_AUTH_FILE -v -t "${DH_VERSION}" | tee -a /tmp/copy-to-quay.sh.result.txt
            return 0; break;
        fi
    done
    # or report an error
    if [[ -z $refUrlCheck ]]; then
        echo "[ERROR] Could not find latest IIBs @ $(date +%H:%M:%S) - cannot push! Try running this pipeline again in a few hours." | tee -a /tmp/copy-to-quay.sh.result.txt
        exit 1
    fi
}

checkIIBExists
