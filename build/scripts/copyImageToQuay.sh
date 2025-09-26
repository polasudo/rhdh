#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#

# script to skopeo copy some image to quay (preserving multiple arches)
# will compute tag from sha if only a sha is provided.

# must be logged in to the source and target registries to read from and copy to

# eg., registry-proxy.engineering.redhat.com/rh-osbs/rhdh-hub-rhel9:1.0-82
# to   quay.io/rhdh/rhdh-hub-rhel9:1.0

usage () {
    echo "Usage: $0 registry/org/image:tag1 registry/org/image2@sha256:...

Example: $0 -v \\
    registry-proxy.engineering.redhat.com/rh-osbs/rhdh-rhdh-hub-rhel9:1.1-47 \\
    registry-proxy.engineering.redhat.com/rh-osbs/rhdh-rhdh-rhel9-operator:1.1-27 \\
    registry-proxy.engineering.redhat.com/rh-osbs/rhdh-rhdh-operator-bundle:1.1-47 

Options:
    -v                     verbose output
    --force                recreate existing tag even if already exists
    --pushtoquay=latest    also create a latest tag
    --pushtoquay=next      also crate a next tag

To copy any arbitrary image, use:
    skopeo --insecure-policy copy --all docker://repo/org/image:tag docker://repo2/org2/image2:tag2
    "
}

# TODO: optionally set other tags if we pass in PUSHTOQUAYTAGS, eg., "latest" or "next" 
PUSHTOQUAYTAGS=""
PUSHTOQUAYFORCE=0

VERBOSE=0
if [[ "$#" -eq 0 ]]; then usage; exit 1; fi

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-v') VERBOSE=1;;
    '-h') usage; exit 1;;
    '--force') PUSHTOQUAYFORCE=1;;
    '--latest'|'--next') PUSHTOQUAYTAGS="${PUSHTOQUAYTAGS} ${1/--/}";;
    --pushtoquay=*) PUSHTOQUAYTAGS="${1#*=})";;
    *) images="$images $1"
  esac
  shift 1
done

for image in $images; do
    PUSHTOQUAYFORCE_LOCAL=${PUSHTOQUAYFORCE}
    IMG=$image
    if [[ $image =~ (.+)@sha256:(.+) ]]; then 
        IMG=${BASH_REMATCH[1]}
        tag=$(skopeo inspect docker://${image} | jq -r '.Labels.version+"-"+.Labels.release')
        container=${IMG}:${tag}
        image=${container}
        if [[ $VERBOSE -eq 1 ]]; then 
            SHA=${BASH_REMATCH[2]}
            echo "Got image $image from $IMG @ $SHA"
        fi
    else
        image=${IMG#*/}
    fi
    TAG=${image##*:}
    REGISTRYPRE=${IMG%%/*}/
    if [[ $IMG =~ .+(rh-osbs/|rhdh/).+ ]]; then REGISTRYPRE="${REGISTRYPRE}${BASH_REMATCH[1]}"; fi
    # echo "DEBUG: image = $image"
    URLfrag=${image##*/} # trim all segments before the image
    # echo "DEBUG: URLfrag = $URLfrag"

    QUAYDEST="${URLfrag}"; 
    if [[ ${QUAYDEST} == *"rhdh-hub-rhel9:"* ]];  then QUAYDEST="rhdh/rhdh-hub-rhel9:${TAG}"; fi
    if [[ ${QUAYDEST} == *"operator-bundle:"* ]]; then QUAYDEST="rhdh/rhdh-operator-bundle:${TAG}"; fi
    if [[ ${QUAYDEST} == *"operator:"* ]];        then QUAYDEST="rhdh/rhdh-rhel9-operator:${TAG}"; fi
    QUAYDEST="quay.io/${QUAYDEST}"

    if [[ $VERBOSE -eq 1 ]]; then
        echo "Source: $REGISTRYPRE $URLfrag"
        echo "Target: $QUAYDEST"
    fi

    if [[ $(skopeo --insecure-policy inspect docker://${QUAYDEST} 2>&1) == *"Error"* ]] || [[ ${PUSHTOQUAYFORCE} -eq 1 ]]; then
        # CRW-1914 copy tag ONLY if it doesn't already exist on the registry, to prevent re-timestamping it and making it look new
        if [[ $VERBOSE -eq 1 ]]; then echo "Copy ${REGISTRYPRE}${URLfrag} to ${QUAYDEST}"; fi
        CMD="skopeo --insecure-policy copy --all docker://${REGISTRYPRE}${URLfrag} docker://${QUAYDEST}"; echo $CMD; $CMD
        PUSHTOQUAYFORCE_LOCAL=1
    else
        if [[ $VERBOSE -eq 1 ]]; then echo "Copy ${QUAYDEST} - already exists, nothing to do"; fi
    fi

    # and update additional PUSHTOQUAYTAGS tags 
    for qtag in ${PUSHTOQUAYTAGS}; do
        if [[ $(skopeo --insecure-policy inspect docker://${QUAYDEST%:*}:${qtag} 2>&1) == *"Error"* ]] || [[ ${PUSHTOQUAYFORCE_LOCAL} -eq 1 ]]; then
            if [[ $VERBOSE -eq 1 ]]; then echo "Copy ${REGISTRYPRE}${URLfrag} to ${QUAYDEST%:*}:${qtag}"; fi
            CMD="skopeo --insecure-policy copy --all docker://${REGISTRYPRE}${URLfrag} docker://${QUAYDEST%:*}:${qtag}"; echo "$CMD"; $CMD
        else
            if [[ $VERBOSE -eq 1 ]]; then echo "Copy ${QUAYDEST%:*}:${qtag} - already exists, nothing to do"; fi
        fi
    done
done
