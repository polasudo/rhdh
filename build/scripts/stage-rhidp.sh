#!/bin/bash

# script to fetch PNC artifacts from the latest successful job, then copy those artifacts to spmm-util.

# requires:
    # spmm-util-users account - see https://issues.redhat.com/browse/SPMM-13576 and https://spmm.pages.redhat.com/util-ansible/#access-prerequisites
    # pig/bacon/pnc cli - see https://project-ncl.github.io/bacon/#installation-and-usage
    # jq/yq - see https://pypi.org/project/yq/
    # curl
    # rsync

set -e

# today's date in yyyy-mm-dd format to use to ensure each GA push is a unique folder
today=$(date +%Y-%m-%d)

VERSION=""
DEBUG=0
PUBLISH=0 # by default don't publish to spmm-util

# TODO use a bot by default here
REMOTE_USER_AND_HOST="nboldt@spmm-util.hosts.stage.psi.bos.redhat.com"

usage () 
{
    echo "Usage: $0 -v x.y.z [--debug] -[w WORKSPACE_DIR]

Options:
    --publish                             publish GA bits for a release to $REMOTE_USER_AND_HOST
    --desthost user@destination-host      specific an alternate destination host for publishing
"
    exit
}

# commandline args
while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-v') VERSION="$2"; shift 1;; # 3.y.0
    '--publish') PUBLISH=1;;
    '--desthost') REMOTE_USER_AND_HOST="$2"; shift 1;;
    '--debug') DEBUG=1;;
    '-w') WORKSPACE="$2"; shift 1;;
  esac
  shift 1
done

if [[ ! "${WORKSPACE}" ]]; then WORKSPACE=/tmp; fi
if [[ ! "${VERSION}" ]]; then usage; fi

FOLDER_PREFIX="rhpib-${VERSION}"
build_config_name="rhpib-${VERSION%.*}-midstream"
TODAY_DIR="${WORKSPACE}/${FOLDER_PREFIX}.${today}"

mkdir -p "${TODAY_DIR}"; cd "${TODAY_DIR}"
if [[ $DEBUG -eq 1 ]]; then
    echo "Working in $TODAY_DIR ..."
fi

# for a given build-config name = rhpib-1.0-midstream, compute ID
build_config_id=$(pnc build-config list --query "name==$build_config_name" | yq -r '.[].id') # 11177
# compute latest successful (with artifacts) build's ID 
last_build_id=$(pnc build-config list-builds --query "status==SUCCESS" "${build_config_id}" | yq -r '.[-1].id') # AZD43DXTMDAAA
if [[ $DEBUG -eq 1 ]]; then
    echo "For build_config_name = $build_config_name, got build_config_id = $build_config_id"
    echo "For build_config_id = $build_config_id, got last_build_id = $last_build_id"
fi

# fetch those artifacts
artifacts=$(pnc build list-built-artifacts "${last_build_id}" 2>/dev/null| yq -r '.[].publicUrl')
tot=0; for d in $artifacts; do (( tot = tot + 1 )); done
for d in $artifacts; do 
    (( i = i + 1 ))
    if [[ $DEBUG -eq 1 ]]; then
        echo "[$i/$tot] Fetch $d ..."
    fi
    curl -sSLkO "$d"
done

# optionally, push files to spmm-util server as part of a GA release
if [[ $PUBLISH -eq 1 ]]; then
    set -x
    # create an empty dir into which we will make subfolders
    empty_dir=$(mktemp -d)

    # delete old releases before pushing latest one, to keep disk usage low
    # note that this operation will only REMOVE old versions
    rsync -rlP --delete --exclude="${FOLDER_PREFIX}.${today}" --exclude="scratch" "$empty_dir"/ "${REMOTE_USER_AND_HOST}:staging/rhpib/"

    # next, update existing ${TARBALL_PREFIX}.${today} folder (or create it not exist)
    rsync -rlP "${TODAY_DIR}" "${REMOTE_USER_AND_HOST}:staging/rhpib/"

    # trigger staging 
    ssh "${REMOTE_USER_AND_HOST}" "stage-mw-release ${FOLDER_PREFIX}.${today}"

    # cleanup 
    rm -fr "$empty_dir"
    set +x
fi
