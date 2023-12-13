#!/bin/bash
#
# Copyright (c) 2023 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# script to query latest IIBs for a given list of OCP versions, then copy those to Quay
# OPM from 4.12 (>v1.26.3 upstream version) is required to run buildCatalog.sh (CRW-4192, OCPBUGS-11841)
#

SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)

usage () {
	echo "Query latest IIBs for a Dev Hub version and optional list of OCP versions, then filter and copy those IIBs to Quay

Requires:
* jq 1.6+, skopeo 1.11+, podman 2.0+, glibc 2.28+
* opm v1.26.3+ (see https://docs.openshift.com/container-platform/4.12/cli_reference/opm/cli-opm-install.html#cli-opm-install )

Usage:
  $0 [OPTIONS]

Options:
  -p, --push                 : Push IIB(s) to quay registry; default is to show commands but not copy anything
  --force                    : If target image exists, will re-filter and re-push it; otherwise skip to avoid updating image timestamps
  -t PROD_VER                : Default: '$DH_VERSION'; NOTE: can push an older bundle using 1.0-zzz instead of latest 1.0
  -e, --extra-tags           : Extra custom tags to create, such as 1.0.0.RC-09-19-v4.13-x86_64
  --sudo                     : run podman commands with sudo
  --no-validate              : do not validate olm-catalog.Dockerfile; default is to validate
  --kaniko                   : use kaniko for container build instead of podman
  --authfile /path/to/json   : path to skopeo/podman auth.json file
  -v                         : Verbose output: include additional information
  -h, --help                 : Show this help
"
}

PODMAN=$(command -v podman)
if [[ ! -x $PODMAN ]]; then echo "[ERROR] podman is not installed. Aborting."; echo; usage; exit 1; fi
command -v skopeo >/dev/null 2>&1 || which skopeo >/dev/null 2>&1 || { echo "skopeo is not installed. Aborting."; exit 1; }
command -v jq >/dev/null 2>&1     || which jq >/dev/null 2>&1     || { echo "jq is not installed. Aborting."; exit 1; }

VERBOSEFLAG=""
BUILD_CATALOG_FLAGS=""
EXTRA_TAGS="" # extra tags to set in target image, eg., 1.0.0.RC-09-19-v4.13-x86_64
PUSHTOQUAYFORCE=0
targetIndexImage=""
AUTHFILE=""

THIS_REPO_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

setDefaults() {
    DH_VERSION="1.0"

    # next or latest tag to set
    FLOATING_QUAY_TAGS="next"
}
setDefaults

if [[ "$#" -lt 1 ]]; then usage; exit 1; fi

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-t') setDefaults; DH_VERSION="$2"; shift 1;;
    '-e'|'--extra-tags') EXTRA_TAGS="${EXTRA_TAGS} ${2}"; shift 1;;
    '-v') VERBOSEFLAG="-v";;
    '--sudo')        BUILD_CATALOG_FLAGS="${BUILD_CATALOG_FLAGS} $1";;
    '--no-validate') BUILD_CATALOG_FLAGS="${BUILD_CATALOG_FLAGS} $1";;
    '--kaniko')      BUILD_CATALOG_FLAGS="${BUILD_CATALOG_FLAGS} $1";;
    '--authfile')    BUILD_CATALOG_FLAGS="${BUILD_CATALOG_FLAGS} $1 $2"; AUTHFILE="$2"; shift 1;;
    '-p'|'--push') PUSH="true";;
    '--force') PUSHTOQUAYFORCE=1;;
    '-h'|'--help') usage; exit 0;;
    *) echo "Unknown parameter used: $1."; usage; exit 1;;
  esac
  shift 1
done

# copy authfile where kaniko can use it in environment configured from https://gitlab.cee.redhat.com/rhidp/cpaas-rhdh-hub/-/blob/rhdh-1.0-rhel-9/build/dockerfiles/kaniko-ubi9.Dockerfile
if [[ $BUILD_CATALOG_FLAGS == *"kaniko"* ]]; then
  mkdir -p /kaniko/.docker/
  cp "$AUTHFILE" /kaniko/.docker/config.json
fi

if [[ $VERBOSEFLAG == "-v" ]]; then
	echo "[DEBUG] DH_VERSION=${DH_VERSION}"
	echo "[DEBUG] THIS_REPO_BRANCH = $THIS_REPO_BRANCH"
	echo "[DEBUG] FLOATING_QUAY_TAGS = $FLOATING_QUAY_TAGS"
    if [[ $EXTRA_TAGS ]]; then echo "[DEBUG] EXTRA_TAGS = $EXTRA_TAGS"; fi
fi

checkVersion() {
  if [[  "$1" = "$(echo -e "$1\n$2" | sort -V | head -n1)" ]]; then
    # echo "[INFO] $3 version $2 >= $1, can proceed."
	true
  else
    echo "[ERROR] Must install $3 version >= $1"
    exit 1
  fi
}
checkVersion 1.1 "$(skopeo --version | sed -e "s/skopeo version //")" skopeo

getScript () {
    scriptFile=$1
    if [[ -x ${SCRIPT_DIR}/"${scriptFile}" ]]; then
        getScript_return=${SCRIPT_DIR}/"${scriptFile}"
    else
        if [[ $VERBOSEFLAG == "-v" ]]; then echo "Downloading ${scriptFile} script from Github"; fi
        pushd /tmp >/dev/null || exit
        curl -sSLO "https://gitlab.cee.redhat.com/rhidp/cpaas-rhdh-hub/-/raw/rhdh-1.0-rhel-9/build/scripts/${scriptFile}" && \
        chmod +x "${scriptFile}"
        getScript_return=/tmp/"${scriptFile}"
        popd >/dev/null || exit
    fi
}

getScript getIIBsForBundle.sh;   getIIBsForBundle=${getScript_return}
getScript getLatestImageTags.sh; getLatestImageTags=${getScript_return}
getScript filterIIB.sh;          filterIIB=${getScript_return}
getScript buildCatalog.sh;       buildCatalog=${getScript_return}

if [[ "$PUSH" != "true" ]]; then
    echo "To filter and publish IIBs, copy the commands below, or re-run using --push flag."
    echo
fi

# compute list of IIBs for a given operator bundle
# rhdh-operator-bundle:1.0-29	registry-proxy.engineering.redhat.com/rh-osbs/iib:573813	v4.12 ==> 29;573813:v4.12
# rhdh-operator-bundle:1.0-29	registry-proxy.engineering.redhat.com/rh-osbs/iib:573824	v4.13 ==> 29;573824:v4.13
# rhdh-operator-bundle:1.0-29	registry-proxy.engineering.redhat.com/rh-osbs/iib:573829	v4.14 ==> 29;573829:v4.14
GIIB_result="$(${getIIBsForBundle} --dh -t "${DH_VERSION}")"
if [[ $VERBOSEFLAG == "-v" ]]; then
	echo "[DEBUG] getIIBsForBundle.sh --dh -t ${DH_VERSION}"
    echo "$GIIB_result"
fi
IIB_OCP_BUNDLES=$(echo "$GIIB_result" | sed -r -e "s#.+bundle:${DH_VERSION%-*}-([0-9]+)\t.+iib:([0-9]+)\t(v[0-9.]+)#\1;\2:\3#")
if [[ $IIB_OCP_BUNDLES == *"[ERROR]"* ]]; then
    if [[ $VERBOSEFLAG != "-v" ]]; then
      echo "$GIIB_result"
    fi 
    if [[ "$GIIB_result" != "$IIB_OCP_BUNDLES" ]]; then
        echo "$IIB_OCP_BUNDLES"
    fi
    exit 1
fi
IIB_OCP_BUNDLES_TO_PUSH=""
for BUNDLE_IIB_OCP in ${IIB_OCP_BUNDLES}; do
    OCP_VER=${BUNDLE_IIB_OCP#*:}
    LATEST_IIB_NUM=${BUNDLE_IIB_OCP%%:*}; LATEST_IIB_NUM=${LATEST_IIB_NUM##*;}
    LATEST_IIB_QUAY="quay.io/rhdh/iib:${DH_VERSION%-*}-${OCP_VER}-${LATEST_IIB_NUM}-$(uname -m)"
    echo "[INFO] OSBS INDEX BUNDLE = registry-proxy.engineering.redhat.com/rh-osbs/iib:${LATEST_IIB_NUM}"
    # if [[ $VERBOSEFLAG == "-v" ]]; then
        # BUNDLE_VER=$DH_VERSION-${BUNDLE_IIB_OCP%%;*}
        # echo "[DEBUG] DH OPERATOR BUNDLE = $BUNDLE_VER"
    # fi

    # check if this image already exists on quay; if so, skip rendering and subsequent steps (no new quay image pushes, no new floating tag updates)
    if [[ ${PUSHTOQUAYFORCE_LOCAL} -eq 1 ]] || [[ $(skopeo --insecure-policy inspect docker://${LATEST_IIB_QUAY} 2>&1) == *"Error"* ]]; then
        IIB_OCP_BUNDLES_TO_PUSH="${IIB_OCP_BUNDLES_TO_PUSH} ${BUNDLE_IIB_OCP}"
        # NOTE: this is NOT OCP server arch, but the arch of the local build machine
        # must build on multiple arches to get per-arch IIBs (eg., for aarch64/arm64, need that arch as a CI runner)
        echo "[INFO] QUAY INDEX BUNDLE = ${LATEST_IIB_QUAY}"

        # filter and publish to a new name, putting all operators in the fast channel
        CATALOG_DIR="/tmp/tmp.copyIIBsToQuay-${DH_VERSION}-${OCP_VER}-${LATEST_IIB_NUM}-$(uname -m)"; mkdir -p "$CATALOG_DIR"
        if [[ $VERBOSEFLAG == "-v" ]]; then echo "[DEBUG] Rendering catalog to: $CATALOG_DIR"; fi
        ${filterIIB} -s "registry-proxy.engineering.redhat.com/rh-osbs/iib:${LATEST_IIB_NUM}" --channel-all fast --dir "$CATALOG_DIR" --packages "rhdh" ${VERBOSEFLAG}
    else
        echo "[INFO] QUAY INDEX BUNDLE = ${LATEST_IIB_QUAY} - already exists. To force update, use copyIIBsToQuay.sh --force"
    fi
    echo
done

# install opm if not present; only needed if we're generating a new IIB
if [[ $IIB_OCP_BUNDLES_TO_PUSH ]]; then
    if [[ ! -x /usr/local/bin/opm ]] && [[ ! -x "${HOME}"/.local/bin/opm ]]; then
        pushd /tmp >/dev/null || exit
        echo "[INFO] Installing latest opm from https://mirror.openshift.com/pub/openshift-v4/$(uname -m)/clients/ocp/latest-4.12/opm-linux.tar.gz ..."
        curl -sSLo- "https://mirror.openshift.com/pub/openshift-v4/$(uname -m)/clients/ocp/latest-4.12/opm-linux.tar.gz" | tar xz; chmod 755 opm
        sudo cp opm /usr/local/bin/ || cp opm "${HOME}"/.local/bin/
        sudo chmod 755 /usr/local/bin/opm || chmod 755 "${HOME}"/.local/bin/opm
        if [[ ! -x /usr/local/bin/opm ]] && [[ ! -x "${HOME}"/.local/bin/opm ]]; then
            echo "[ERROR] Could not install opm v1.26.3 or higher (see https://docs.openshift.com/container-platform/4.12/cli_reference/opm/cli-opm-install.html#cli-opm-install )";
            exit 1
        fi
        popd >/dev/null || exit
    fi
fi
for BUNDLE_IIB_OCP in ${IIB_OCP_BUNDLES_TO_PUSH}; do
    OCP_VER=${BUNDLE_IIB_OCP#*:}
    LATEST_IIB_NUM=${BUNDLE_IIB_OCP%%:*}; LATEST_IIB_NUM=${LATEST_IIB_NUM##*;}
    PUSHTOQUAYFORCE_LOCAL=${PUSHTOQUAYFORCE}

    # NOTE: this is NOT OCP server arch, but the arch of the local build machine
    # must build on multiple arches to get per-arch IIBs
    LATEST_IIB_QUAY="quay.io/rhdh/iib:${DH_VERSION%-*}-${OCP_VER}-${LATEST_IIB_NUM}-$(uname -m)"
    CATALOG_DIR="/tmp/tmp.copyIIBsToQuay-${DH_VERSION}-${OCP_VER}-${LATEST_IIB_NUM}-$(uname -m)"; mkdir -p "$CATALOG_DIR"

    set -x

    BUILD_CATALOG_DESTFLAGS=""
    # shellcheck disable=SC2086
    if [[ "$PUSH" != "true" ]]; then
        ${buildCatalog} \
            -t "${LATEST_IIB_QUAY}" --dir "$CATALOG_DIR" --ocp-ver $OCP_VER ${VERBOSEFLAG} ${BUILD_CATALOG_FLAGS}
        # If we're not pushing, we're done processing the IIB for this OCP_VER -- skopeo inspect and copy fail if the image
        # has not been pushed.
    else
        # skopeo copy to additional tags
        ALL_TAGS="${DH_VERSION%-*}-${OCP_VER}-$(uname -m)"
        for atag in $FLOATING_QUAY_TAGS; do
            ALL_TAGS="${ALL_TAGS} ${atag}-${OCP_VER}-$(uname -m)"
        done
        for atag in $EXTRA_TAGS; do
            ALL_TAGS="${ALL_TAGS} ${atag}-${OCP_VER}-$(uname -m)"
        done

        # get extra tags for this image
        for qtag in ${ALL_TAGS}; do
            BUILD_CATALOG_DESTFLAGS="${BUILD_CATALOG_DESTFLAGS} --destination quay.io/rhdh/iib:${qtag}"
        done

        # check if destination already exists in quay, or force updating, or always update if using kaniko
        # shellcheck disable=SC2086
        if [[ ${PUSHTOQUAYFORCE} -eq 1 ]] || [[ $BUILD_CATALOG_FLAGS == *"kaniko"* ]] || [[ $(skopeo --insecure-policy inspect docker://${LATEST_IIB_QUAY} 2>&1) == *"Error"* ]]; then
            ${buildCatalog} --push \
                -t ${LATEST_IIB_QUAY} --dir $CATALOG_DIR --ocp-ver $OCP_VER ${VERBOSEFLAG} ${BUILD_CATALOG_FLAGS} ${BUILD_CATALOG_DESTFLAGS}
            PUSHTOQUAYFORCE_LOCAL=1
        else
            if [[ $VERBOSEFLAG == "-v" ]]; then echo "Copy ${LATEST_IIB_QUAY} - already exists, nothing to do"; fi
            echo "[IMG] ${LATEST_IIB_QUAY}"
        fi
        if [[ $BUILD_CATALOG_FLAGS != *"kaniko"* ]]; then
            # shellcheck disable=SC2086
            if [[ $(skopeo --insecure-policy inspect docker://${LATEST_IIB_QUAY} 2>&1) == *"Error"* ]]; then
                echo "[ERROR] Cannot find image ${LATEST_IIB_QUAY} to copy!"
                echo "[ERROR] Check output of this command for an idea of what went wrong:"
                echo "[ERROR] ${buildCatalog} -t ${LATEST_IIB_QUAY} --dir $CATALOG_DIR --ocp-ver $OCP_VER --push -v ${BUILD_CATALOG_FLAGS} ${BUILD_CATALOG_DESTFLAGS}"
                exit 1
            fi

            for qtag in ${ALL_TAGS}; do
                # shellcheck disable=SC2086
                if [[ ${PUSHTOQUAYFORCE_LOCAL} -eq 1 ]] || [[ $(skopeo --insecure-policy inspect docker://quay.io/rhdh/iib:${qtag} 2>&1) == *"Error"* ]]; then
                    CMD="skopeo --insecure-policy copy --all docker://${LATEST_IIB_QUAY} docker://quay.io/rhdh/iib:${qtag}"
                    if [[ $VERBOSE -eq 1 ]]; then
                        echo $CMD
                        if [[ "$PUSH" == "true" ]]; then $CMD; fi
                    else
                        if [[ "$PUSH" == "true" ]]; then $CMD -q; fi
                        echo "[IMG] quay.io/rhdh/iib:${qtag}"
                    fi
                else
                    if [[ $VERBOSEFLAG == "-v" ]]; then echo "Copy quay.io/rhdh/iib:${qtag} - already exists, nothing to do"; fi
                fi
            done
        fi
    fi

    # cleanup images
    if [[ $BUILD_CATALOG_FLAGS != *"kaniko"* ]]; then
        # shellcheck disable=SC2086
        $PODMAN rmi --ignore --force "registry-proxy.engineering.redhat.com/rh-osbs/iib:${LATEST_IIB_NUM}" $targetIndexImage >/dev/null 2>&1 || true
    fi
done

# cleanup temp space
rm -fr /tmp/render-registry* /tmp/tmp.*
