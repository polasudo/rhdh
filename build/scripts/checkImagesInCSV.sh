#!/usr/bin/env bash
#
# Copyright (c) 2023 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#

# for a given metadata or bundle container, check the RELATED_IMAGE's digests align to specific images

SCRIPT=$(readlink -f "$0"); SCRIPTPATH=$(dirname "$SCRIPT")

# by default resolve image tags / digests from RHEC or as stated in the CSV; with this override, check Quay if can't find in RHEC
QUAY=0
# by default resolve image tags / digests from RHEC or as stated in the CSV; with this override, check Brew if can't find in RHEC
BREW=0
# by default, show the tag :: image@sha; optionally just show image:tag
QUIET=0
# by default show all images; optionally filter for one or more, eg 'devfile|plugin|udi'
REGEX_FILTER=""
# by default show tags; use this to show digests only (eg., for use with a script that copies images inside an airgap)
SHOW_DIGESTS_ONLY=0
# default
OCP_VER=4.18

norm="\033[0;39m"
green="\033[1;32m"
blue="\033[1;34m"
red="\033[1;31m"

# cleanup /tmp files
rm -fr /tmp/job-config.json || true

usage () {
  if [[ ! $PROD_VER ]]; then
    # compute a default value for PROD_VER to use in usage()
    PROD_VER="$(curl -sSLk --url "https://gitlab.cee.redhat.com/api/v4/projects/rhidp%2Frhdh/repository/branches?per_page=200&regex=^rhdh-1..*-rhel-9$" | jq -r '.[].name' | sort -uV | tail -1 | sed -r -e "s/rhdh-//" -e "s/-rhel-[0-9]+//")"
  fi

  echo "
Usage:
  Using a specific bundle: $0 bundle-image1 [bundle-image2...] [OPTIONS]
  Using the latest bundle: $0 -t $PROD_VER -o 4.18 [OPTIONS]

Options:
  -t <product tag>     Use getLatestImageTags.sh to fetch latest IIB's contained bundle image, 
  -o <OCP version>     and check that bundle's CSV; BOTH these are required; default: $OCP_VER

  -y, --quay           If image not resolved from RH Ecosystem Catalog, check equivalent image on quay.io
  --brew               If image not resolved from RH Ecosystem Catalog, check equivalent image on brew.registry.redhat.io
  -i, --filter         Rather than return ALL images in the build, include a subset using grep -E
  -q, --quiet          Quiet output: show 'image:tag' instead of default 'tag :: image@sha'
  -qq, --quieter       Quieter output: omit everything but related images
  --digests            Instead of showing tags, just show image digests as seen in the IIB/CSV

Examples:
  $0 -y -q quay.io/rhdh/rhdh-operator-bundle:$PROD_VER
  $0 -y -i 'hub|operator|postgresql' quay.io/rhdh/rhdh-operator-bundle:$PROD_VER
  $0 -y -q -t $PROD_VER

To compare latest image in Quay to latest CSV in bundle in latest IIB:
  TAG=$PROD_VER; \\
  IMG=rhdh/hub-rhel9; \\
  img_quay=\$(${SCRIPTPATH}/getLatestImageTags.sh -b rhdh-\${TAG}-rhel-9 --quay --tag \"\${TAG}-\" -c \${IMG}); echo \$img_quay; \\
  img_iib=\$(${SCRIPTPATH}/checkImagesInCSV.sh --ds -t \${TAG} -o 4.18 -y -qq -i \${IMG}); echo \$img_iib; \\
  if [[ \$img_quay != \$img_iib ]]; then \\
    ${SCRIPTPATH}/checkImagesInCSV.sh --ds -t \${TAG} -o 4.18 -y -i \${IMG}; \\
  fi
"
}

if [[ $# -lt 1 ]]; then usage; exit; fi

while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-t') PROD_VER="$2"; shift 1;;
    '-o') OCP_VER="$2"; shift 1;;
    '-y'|'--quay') QUAY=1;;
    '--brew') BREW=1;;
    '-i'|'--filter') REGEX_FILTER="$2"; shift 1;;
    '-v')              QUIET=0;;
    '-q'|'--quiet')    QUIET=1;;
    '-qq'|'--quieter') QUIET=2;;
    '--digests') SHOW_DIGESTS_ONLY=1;;
    *) IMAGES="${IMAGES} $1";;
  esac
  shift 1
done

if [[ ! $IMAGES ]] && [[ ! $OCP_VER ]]; then 
  echo "[ERROR] must specify both product and OCP versions, or the full registry/org/name:tag-or-sha of the bundle"
  usage
fi

if [[ $PROD_VER ]] && [[ $PROD_VER != "1.yy" ]] && [[ ! $IMAGES ]]; then # compute latest IIB -> bundle
  if [[ $QUIET -lt 2 ]]; then
    echo "Checking for IIB for ${PROD_VER}, OCP = $OCP_VER"
  fi
  GLIT=${SCRIPTPATH}/getLatestImageTags.sh
  IMAGES=$(${GLIT} --quay -c rhdh/rhdh-operator-bundle --tag "${PROD_VER}-")
  if [[ $QUIET -lt 2 ]]; then
    echo "> $IMAGES"
  fi
fi

# echo "REGEX_FILTER = $REGEX_FILTER"
MIDSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")
if [[ ${MIDSTM_BRANCH} != "rhdh-"*"-rhel-"* ]]; then MIDSTM_BRANCH="rhdh-1-rhel-9"; fi

# shellcheck disable=SC2086
for imageAndTag in $IMAGES; do 
    SOURCE_CONTAINER=${imageAndTag%%:*}
    containerTag=$(skopeo inspect docker://${imageAndTag} | jq -r '.Labels.version+"-"+.Labels.release')
    if [[ "$imageAndTag" =~ ^(registry.redhat.io/rhdh/rhdh-operator-bundle:[0-9.-]+) ]]; then
      if [[ "$containerTag" =~ ^([0-9.]+)-[0-9]+ ]]; then
        # remove the -zzz since that's not in RHEC
        echo -e "${blue}[WARN] Use registry.redhat.io/rhdh/rhdh-operator-bundle:${BASH_REMATCH[1]} (not :$containerTag)${norm}"
        containerTag="${BASH_REMATCH[1]}" # 1.7-67 ==> 1.7
      fi
    fi

    # echo "Found containerTag = ${containerTag}"

    if [[ ! -x ${SCRIPTPATH}/containerExtract.sh ]]; then
        curl -sSLO https://gitlab.cee.redhat.com/rhidp/rhdh/-/raw/${MIDSTM_BRANCH}/build/scripts/containerExtract.sh
        chmod +x containerExtract.sh
    fi
    rm -fr /tmp/${SOURCE_CONTAINER//\//-}-${containerTag}-*/
    "${SCRIPTPATH}"/containerExtract.sh ${SOURCE_CONTAINER}:${containerTag} --delete-before --delete-after >/dev/null 2>&1 || true
    related_images=$(cat /tmp/${SOURCE_CONTAINER//\//-}-${containerTag}-*/manifests/*.{csv,clusterserviceversion}.yaml 2>/dev/null | grep sha256: | sed -r -e "s@.+(value|mage\"*): @@" -e "s@\"(.+)\".+@\1@" | sort -uV)
    for related_image in $related_images; do 
        if [[ $REGEX_FILTER ]]; then related_image=$(echo "$related_image" | grep -E "$REGEX_FILTER"); fi

        # support the format repo/org/image:tag@sha256:SHA - just return repo/org/image@sha256:SHA
        if [[ "${related_image}" ]] && [[ $related_image =~ (.+):(.+)(@sha256:.+) ]]; then 
          IMG=${BASH_REMATCH[1]}
          # TAG=${BASH_REMATCH[2]}
          SHA=${BASH_REMATCH[3]}
          related_image="${IMG}${SHA}"
        fi

        if [[ "${related_image}" ]]; then
          # check each image digest to compute matching tag
          jqdump="$(skopeo inspect docker://${related_image} 2>&1)"
          if [[ $jqdump == *"Labels"* ]]; then 
              tag=$(echo $jqdump | jq -r '.Labels.version+"-"+.Labels.release')
          else
              if [[ $QUAY -eq 1 ]]; then # check quay
                related_image=${related_image//registry.redhat.io/quay.io}
                jqdump="$(skopeo inspect docker://${related_image} 2>&1)"
                if [[ $jqdump == *"Labels"* ]]; then 
                    tag=$(echo $jqdump | jq -r '.Labels.version+"-"+.Labels.release')
                fi
              elif [[ $BREW -eq 1 ]]; then # check brew registry
                # NOTE: could use registry-proxy.engineering.redhat.com/rh-osbs/ instead but that's internal facing, 
                # where brew.reg is auth'd and public
                # convert registry.redhat.io/rhdh/rhdh-rhel9-operator
                # to      brew.registry.redhat.io/rh-osbs/rhdh-rhdh-rhel9-operator
                related_image=$(echo $related_image | sed -r -e "s#registry.redhat.io/([^/]+)/#brew.registry.redhat.io/rh-osbs/\1-#")
                jqdump="$(skopeo inspect docker://${related_image} 2>&1)"
                if [[ $jqdump == *"Labels"* ]]; then 
                    tag=$(echo $jqdump | jq -r '.Labels.version+"-"+.Labels.release')
                fi
              else 
                  tag="NOT FOUND!"
              fi
          fi
          if [[ $SHOW_DIGESTS_ONLY -eq 1 ]]; then
            echo "$related_image"
          elif [[ $QUIET -gt 0 ]]; then
            echo "${related_image%@sha256*}:$tag"
          else
            echo "$tag :: $related_image"
          fi
        fi
    done
done
