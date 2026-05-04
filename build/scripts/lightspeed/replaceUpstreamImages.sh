#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
#
# replaces lightspeed flavour upstream container images with the product
# ones under the operator bundles
#
# requires jq
# requires yq (python wrapper for jq)

# error if the required arguments are not met
if [ $# -gt 2 ] || [ $# -lt 1 ]; then
    echo "expected one required argument: $0 <dh_image_tag> [bundle_dir]"
    exit 1
fi

## Re-use functions from sync-midstream.sh ##

# from https://stackoverflow.com/questions/11268437/how-to-convert-string-to-integer-in-unix-shelll/59781257#59781257
int(){ printf '%d' "${1:-}" 2>/dev/null || :; }

checkImage () {
    local USE_QUAY="true"
    local QUIET=1

    checkImage_result=""
    local imageAndSHA="$1"
    imageAndSHA=${imageAndSHA/registry.redhat.io\/rhdh/quay.io\/rhdh}
    imageAndSHA=${imageAndSHA%%@*}
    imageOnly=${imageAndSHA%%:*}
    if [[ $QUIET -eq 0 ]]; then echo "For $imageAndSHA"; fi

    # echo "[DEBUG] Got image = $image"
    # shellcheck disable=SC2086
    image_version=$(skopeo inspect docker://${imageAndSHA} 2>/dev/null | jq -r '.Labels.version')
    # shellcheck disable=SC2086
    image_release=$(skopeo inspect docker://${imageAndSHA} 2>/dev/null | jq -r '.Labels.release')

    # echo "[DEBUG] For $imageOnly, got $image_version - $image_release"
    if [[ $image_version ]] && [[ $image_release ]]; then
        container=${imageOnly}:${image_version}-${image_release}
        digest="$(skopeo inspect "docker://${container}" 2>/dev/null | jq -r '.Digest' 2>/dev/null )"
        if [[ $digest ]]; then
          container="${container%:*}@$digest"
          if [[ $QUIET -eq 0 ]]; then echo "Got $container for ${imageOnly}:${image_version}-${image_release}"; else echo "       * $container (${imageOnly}:${image_version}-${image_release})"; fi
        else
          # try previous image
          # shellcheck disable=SC2086
          image_release=$(int $image_release)
          (( image_release = image_release-1 ))
          container=${imageOnly}:${image_version}-${image_release}
          digest="$(skopeo inspect "docker://${container}" 2>/dev/null | jq -r '.Digest' 2>/dev/null )"
          if [[ $digest ]]; then
            container="${container%:*}@$digest"
            if [[ $QUIET -eq 0 ]]; then echo "Got $container for ${imageOnly}:${image_version}-${image_release}"; else echo "       * $container (${imageOnly}:${image_version}-${image_release})"; fi
          else
            # no digest, so just use :tag
            container=${imageOnly}:${image_version}
            digest="$(skopeo inspect "docker://${container}" 2>/dev/null | jq -r '.Digest' 2>/dev/null )"
            if [[ $digest ]]; then
              container="${container%:*}@$digest"
            fi
            if [[ $QUIET -eq 0 ]]; then echo "Got $container for ${imageOnly}:${image_version}"; else echo "       * $container (${imageOnly}:${image_version})"; fi
          fi
        fi
        checkImage_result="$container"
    else
        if [[ ${imageAndSHA} == "quay.io/"* ]];then 
            echo "Not found"
        elif [[ $USE_QUAY != "true" ]]; then 
            echo "Not found; try --quay or -y flag to check same image on quay.io registry"
        fi
        if [[ "$USE_QUAY" == "true" ]]; then
            checkImage_result="NONE"
        fi
    fi
    # skopeo inspect docker://${container} | jq -r .Digest # note, this might be different from the input SHA, but still equivalent 
}

#############################################

bundle_dir="${2:-"$(pwd)"}"
dh_image_tag="$1"

SCRIPT=$(readlink -f "$0")
ROOTPATH=$(dirname "$SCRIPT"); ROOTPATH=${ROOTPATH/\/build\/scripts\/lightspeed}

# Lightspeed Core Service Image
lcs_tag="$(bash "${ROOTPATH}/build/scripts/lightspeed/fetchLCSTag.sh" "${dh_image_tag}")"

declare -A digest_mapping

# replace upstream refs in lightspeed flavour configmap
    # image: quay.io/lightspeed-core/lightspeed-stack:0.4.0
    # image: quay.io/redhat-ai-dev/rag-content:release-1.9-lcs
yml="${bundle_dir}/manifests/rhdh-flavour-lightspeed-config_v1_configmap.yaml"
echo -e "\n[INFO] Transform $yml ..."
sed -i $yml -r \
    -e "s@'?quay.io/lightspeed-core/lightspeed-stack:.+'?@registry.redhat.io/lightspeed-core/lightspeed-stack-rhel9:${lcs_tag}@g" \
    -e "s@'?quay.io/redhat-ai-dev/rag-content:.+'?@quay.io/rhdh/rhdh-rag-content-rhel9:${dh_image_tag}@g"
for d in \
    registry.redhat.io/lightspeed-core/lightspeed-stack-rhel9:${lcs_tag} \
    quay.io/rhdh/rhdh-rag-content-rhel9:${dh_image_tag}\
; do
    # if using a RHDH midstream image, use checkImage function
    if [[ $d =~ "quay.io/rhdh"* ]] || [[ $d =~ "registry.redhat.io/rhdh"* ]]; then
        if [[ ! ${digest_mapping[$d]} ]]; then 
            checkImage "$d"
            echo "       + Got $checkImage_result for $d"
            if [[ "$checkImage_result" != "NONE" ]]; then
                digest_mapping["${d}"]="${checkImage_result}"
            fi
        else
            echo "       > Use ${digest_mapping[$d]} for $d"
            checkImage_result="${digest_mapping[$d]}"
        fi
        if [[ "$checkImage_result" != "NONE" ]]; then
            sed -i $yml -r -e "s|$d|$checkImage_result|g" 
        fi
        continue
    fi
    image_name=${d%:*}
    image_digest="$(skopeo inspect "docker://${d}" 2>/dev/null | jq -r '.Digest' 2>/dev/null)"

    if [[ $image_digest ]]; then
        image_with_digest="${image_name}@${image_digest}"

        sed -i $yml -r -e "s|$d|$image_with_digest|g" 
    fi
done

# replace quay.io midstream with r.r.io downstream
sed -i $yml -r \
    -e "s@quay.io/rhdh/@registry.redhat.io/rhdh/@g"
