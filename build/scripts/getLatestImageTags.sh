#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#

# script to query latest tags for a given list of imags in RHEC
# REQUIRES: 
#    * skopeo >=1.1 (for authenticated registry queries, and to use --override-arch for s390x images)
#    * jq to do json queries
#    * yq to do yaml queries (install the python3 wrapper for jq using pip)
# 
# https://registry.redhat.io is v2 and requires authentication to query, so login in first like this:
# docker login registry.redhat.io -u=USERNAME -p=PASSWORD

# see exclude list in getLatestImageTags.sh and updateBaseImages.sh
EXCLUDES="latest|-source|next|nightly|-tmp-|-ci-|-gh-|.att|.git|.src|.sig|.sbom|.prefetch|on-pull-|on-push-|on-pr-|sha256-|-container"
# EXCLUDES_TIMESTAMPED='[0-9]+\.[0-9]+\.[0-9]+-[0-9]{10}' # if set, exclude x.y.z-timestamp tags

# try to compute branches from currently checked out branch; else fall back to hard coded value
DWNSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")
if [[ ${DWNSTM_BRANCH} != "rhdh-"*"-rhel-"* ]]; then DWNSTM_BRANCH="rhdh-1-rhel-9"; fi

norm="\033[0;39m"
green="\033[1;32m"
blue="\033[1;34m"
red="\033[1;31m"

getVersion ()
{
	if [[ -f distgit/containers/rhdh-hub/package.json ]]; then
		VERSION=$(yq -r '.version' distgit/containers/rhdh-hub/package.json); VERSION=${VERSION%.*} # 1.2
	fi
}
getVersion

getDHVersion ()
{
	if [[ $DWNSTM_BRANCH != "rhdh-1."*"-rhel-9" ]] && [[ $DWNSTM_BRANCH != "rhdh-1-rhel-9" ]]; then
		if [[ ${VERSION} != "" ]]; then
			DWNSTM_BRANCH="rhdh-${VERSION}-rhel-9"
		else 
			DWNSTM_BRANCH="rhdh-1-rhel-9"
			VERSION="1.next"
		fi
	else
		DH_VERSION=${DWNSTM_BRANCH/rhdh-/}; DH_VERSION=${DH_VERSION/-rhel-9/}
	fi
}
getDHVersion

command -v skopeo >/dev/null 2>&1 || which skopeo >/dev/null 2>&1 || { echo "skopeo is not installed. Aborting."; exit 1; }
command -v jq >/dev/null 2>&1     || which jq >/dev/null 2>&1     || { echo "jq is not installed. Aborting."; exit 1; }
command -v yq >/dev/null 2>&1     || which yq >/dev/null 2>&1     || { echo "yq is not installed. Aborting."; exit 1; }
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

DH_CONTAINERS="\
rhdh/rhdh-hub-rhel9 \
rhdh/rhdh-rhel9-operator \
rhdh/rhdh-operator-bundle \
"

QUIET=1 	# less output - omit container tag URLs
VERBOSE=0	# more output
HIDE_MISSING=0 # if 0, show repo/org/image:??? for missing tags; if 1, don't show anything if tag missing
ARCHES=0	# show architectures
NUMTAGS=1 	# by default show only the latest tag for each container; or show n latest ones
TAGONLY=0 	# by default show the whole image; if true, show ONLY tags
SHOWHISTORY=0 # compute the base images defined in the Dockerfile's FROM statement(s): NOTE: requires that the image be pulled first 
PUSHTOQUAY=0 # utility method to pull then push to quay
PUSHTOQUAYTAGS="" # utility method to pull then push to quay (extra tags to push)
PUSHTOQUAYFORCE=0 # normally, don't repush a tag if it's already in the registry (to avoid re-timestamping it and updating tag history)
SORTED=0 # if 0, use the order of containers in the DS*_CONTAINERS_* strings above; if 1, sort alphabetically
latestNext="latest"; if [[ $DH_VERSION == "1.y" ]] || [[ $DWNSTM_BRANCH == "rhdh-1-rhel-9" ]]; then latestNext="next  "; fi

# cleanup /tmp files
cleanup_temp () {
	rm -fr /tmp/job-config.json || true
}

usage () {
	getVersion
	getDHVersion
	echo "
Usage: 
  $0 -b ${DWNSTM_BRANCH} --quay --tag \"${DH_VERSION}-\" --hide        | use default quay.io/rhdh images, for tag ${DH_VERSION}-; show nothing if unmatched tag
  $0 -b ${DWNSTM_BRANCH} --stage --sort                    | use default list of DH images in RHEC Stage, sorted alphabetically
  $0 -b ${DWNSTM_BRANCH} --arches                          | use default list of DH images in RHEC Prod; show arches
  $0 -c rhdh/iib --quay -o v4.18 --tag ${DH_VERSION}-v4.18          | search for latest IIBs in quay for a given OCP version

  $0 -c rhdh/rhdh-hub-rhel9 --quay                        | check latest tag for specific Quay image(s), with branch = ${DWNSTM_BRANCH}
  $0 -c ubi9-minimal -c ubi9-micro -n 3 --tag .           | check RHEC prod registry; show all tags; show 3 tags per container
  $0 -c 'ubi9/go-toolset' --tag 1.1*                      | check RHEC prod registry; show 1.1* tags (exclude latest and -sources)
  $0 -c pivotaldata/centos --docker --dockerfile          | check docker registry; show Dockerfile contents (requires dfimage)
"
}
if [[ $# -lt 1 ]]; then usage; cleanup_temp; exit 1; fi

REGISTRY="https://registry.redhat.io" # or https://registry-1.docker.io or https://registry.access.redhat.com
CONTAINERS=""
while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-j') DH_VERSION="$2"; DWNSTM_BRANCH="rhdh-${DH_VERSION}-rhel-9"; shift 1;;
    '-b') DWNSTM_BRANCH="$2"; 
        if [[ $DWNSTM_BRANCH != "rhdh-1-rhel-9" ]]; then latestNext="latest  "; fi; shift 1;; 
    '-c') CONTAINERS="${CONTAINERS} $2"; shift 1;;
    '-x') EXCLUDES="$2"; shift 1;;
    '-q') QUIET=1;;
    '-v') QUIET=0; VERBOSE=1;;
    '--hide') HIDE_MISSING=1;;
    '-a'|'--arches') ARCHES=1;;
    '-r') REGISTRY="$2"; shift 1;;
    '--rhec'|'--rhcc') REGISTRY="http://registry.redhat.io";;
    '--stage') REGISTRY="http://registry.stage.redhat.io";; # does this still work and provide value?
    '-d'|'--docker') REGISTRY="http://docker.io";;
    '--quay') REGISTRY="http://quay.io";;
    '--pushtoquay') PUSHTOQUAY=1; PUSHTOQUAYTAGS="";;
    --pushtoquay=*) PUSHTOQUAY=1; PUSHTOQUAYTAGS="$(echo "${1#*=}")";;
    '--pushtoquayforce') PUSHTOQUAYFORCE=1;;
	'--latestNext') latestNext="$2"; shift 1;;
	# since we have no next or latest tags for IIB images, append an OCP version and arch and filter for those by default
	'-o')
        if [[ $DWNSTM_BRANCH != "rhdh-1-rhel-9" ]] || [[ $DH_VERSION != "1.y" ]]; then 
            latestNext="latest-$2-$(uname -m)"
        else
            latestNext="next-$2-$(uname -m)"
        fi
        BASETAG="$2"; shift 1;;
    '-n') NUMTAGS="$2"; shift 1;;
    '--dockerfile') SHOWHISTORY=1;;
    '--tag') BASETAG="$2"; shift 1;;
    '--candidatetag') candidateTag="$2"; shift 1;;
    '--tagonly') TAGONLY=1;;
    '--sort') SORTED=1;;
    '-h'|'--help') usage; cleanup_temp; exit 1;;
  esac
  shift 1
done

if [[ $CONTAINERS == *"rhdh/iib"* ]]; then
	if [[ $latestNext == "latest" ]] || [[ $latestNext == "next  " ]]; then
		echo "[ERROR] For Quay IIB searches, must specify OCP version. For example: '-o v4.12'"; usage; cleanup_temp; exit 2
	fi
fi

# need this for quay repo when we might not have a :latest tag (but do have a :next one)
searchTag=""

# echo "DWNSTM_BRANCH = $DWNSTM_BRANCH"
# tag to search for in quay
if [[ -z ${BASETAG} ]] && [[ ${DWNSTM_BRANCH} ]]; then
	BASETAG=${DWNSTM_BRANCH#*-}
	BASETAG=${BASETAG%%-*}
	# since now using extended grep, add \ before the . so it only matches ., not anything
	BASETAG=${BASETAG//\./\\.}
elif [[ "${BASETAG}" ]]; then # if --tag flag used, don't use derived value or fail
	true
else
	usage; cleanup_temp; exit 3
fi
if [[ -z ${candidateTag} ]] && [[ ${DWNSTM_BRANCH} ]]; then
	candidateTag="${DWNSTM_BRANCH}-container-candidate"
else
	usage; cleanup_temp; exit 4
fi

if [[ $VERBOSE -eq 1 ]]; then 
	echo "[DEBUG] DH_VERSION=${DH_VERSION}"
	echo "[DEBUG] DWNSTM_BRANCH = ${DWNSTM_BRANCH}"
	echo "[DEBUG] BASETAG = $BASETAG"
	echo "[DEBUG] candidateTag = $candidateTag"
	echo "[DEBUG] containers = $CONTAINERS"
	echo "[DEBUG] latestNext = $latestNext"
fi

if [[ ${REGISTRY} != "" ]]; then 
	REGISTRYSTRING="--registry ${REGISTRY}"
	REGISTRYPRE="${REGISTRY##*://}/"
	if [[ ${REGISTRY} == *"registry-proxy.engineering.redhat.com"* ]]; then
		if [[ ${CONTAINERS} == "" ]] || [[ ${CONTAINERS} == "${DH_CONTAINERS}" ]]; then 
			CONTAINERS="${DH_CONTAINERS}"; CONTAINERS=${CONTAINERS//${DWNSTM_BRANCH}-/}; CONTAINERS="${CONTAINERS//rhdh\//rhdh-}"
			# CONTAINERS="${CONTAINERS//rhdh-rhdh-operator-bundle/rhdh-operator-bundle}"
			# CONTAINERS="${CONTAINERS/rhdh-rhel9-operator/rhdh-rhdh-rhel9-operator}"
		fi
	elif [[ ${REGISTRY} == *"quay.io"* ]] || [[ ${REGISTRY} == *"registry.redhat.io"* ]]; then
		searchTag=":${latestNext}"
		if [[ ${CONTAINERS} == "${DH_CONTAINERS}" ]] || [[ ${CONTAINERS} == "" ]]; then
			CONTAINERS="${DH_CONTAINERS}"; 
		fi
	elif [[ ! ${CONTAINERS} ]]; then
		CONTAINERS="${DH_CONTAINERS}"
	fi
else
	REGISTRYSTRING=""
	REGISTRYPRE=""
fi
if [[ $VERBOSE -eq 1 ]]; then 
	echo "[DEBUG] REGISTRYSTRING = $REGISTRYSTRING"
	echo "[DEBUG] REGISTRYPRE = $REGISTRYPRE"
fi

# see https://hub.docker.com/r/laniksj/dfimage
if [[ $SHOWHISTORY -eq 1 ]]; then
	if [[ ! $(docker images | grep  laniksj/dfimage) ]]; then 
		echo "Installing dfimage ..."
		docker pull laniksj/dfimage 2>&1
	fi
fi

if [[ ${CONTAINERS} == "" ]]; then usage; cleanup_temp; exit 5; fi

# sort the container list
if [[ $SORTED -eq 1 ]]; then CONTAINERS=$(tr ' ' '\n' <<< "${CONTAINERS}" | sort | uniq); fi

c=0 # containers total
n=0 # containers found
for URLfrag in $CONTAINERS; do
	(( c = c + 1 ))
	(( n = n + 1 ))
	URLfragtag=${URLfrag##*:}
	if [[ ${URLfragtag} == "${URLfrag}" ]]; then # tag appended on url
		URL="https://access.redhat.com/containers/?tab=tags#/registry.access.redhat.com/${URLfrag}"
		URLfragtag="^-"
	else
		URL="https://access.redhat.com/containers/?tab=tags#/registry.access.redhat.com/${URLfrag%%:*}"
		URLfragtag="^- ${URLfragtag}"
	fi

	ARCH_OVERRIDE="--override-arch amd64" 
	# optional override so that an image without amd64 won't return a failure when searching on amd64 arch machines
	if [[ ${URLfrag} == *"-openj9"* ]]; then
		ARCH_OVERRIDE="--override-arch s390x"
	fi

	# shellcheck disable=SC2001
	QUERY="$(echo "$URL" | sed -e "s#.\+\(registry.redhat.io\|registry.access.redhat.com\)/#skopeo inspect ${ARCH_OVERRIDE} docker://${REGISTRYPRE}#g")${searchTag}"
	if [[ $VERBOSE -eq 1 ]]; then 
		echo ""; echo -n "LATESTTAGs=\"\$($QUERY | jq -r .RepoTags[] | grep -E -v '${EXCLUDES}' | grep -E '${BASETAG}' | sort -V)\"; "
	fi
	LATESTTAGs="$(${QUERY} 2>/dev/null | jq -r .RepoTags[] | grep -E -v "${EXCLUDES}" | grep -E "${BASETAG}" | sort -V)"
	if [[ ! ${LATESTTAGs} ]]; then # try again with -container suffix
		QUERY="$(echo "${URL}-container" | sed -e "s#.\+\(registry.redhat.io\|registry.access.redhat.com\)/#skopeo inspect ${ARCH_OVERRIDE} docker://${REGISTRYPRE}#g")"
		if [[ $VERBOSE -eq 1 ]]; then 
		    echo ""; echo -n "LATESTTAGs=\"\$($QUERY | jq -r .RepoTags[] | grep -E -v '${EXCLUDES}' | grep -E '${BASETAG}' | sort -V)\"; " 
		fi
		LATESTTAGs="$(${QUERY} 2>/dev/null | jq -r .RepoTags[] | grep -E -v "${EXCLUDES}" | grep -E "${BASETAG}" | sort -V)"
	fi

	# exclude timestamped containers and/or sort and grab only the last n tags
	if [[ $EXCLUDES_TIMESTAMPED ]]; then
		if [[ $VERBOSE -eq 1 ]]; then 
		    echo "echo \"\$LATESTTAGs\" | grep -E -v \"${EXCLUDES_TIMESTAMPED}\" | tail -5" 
		fi
		LATESTTAGs="$(echo "$LATESTTAGs" | grep -E -v "${EXCLUDES_TIMESTAMPED}" | tail -${NUMTAGS})"
	else 
		if [[ $VERBOSE -eq 1 ]]; then 
		    echo "echo \"\$LATESTTAGs\" | tail -5" 
		fi
		LATESTTAGs="$(echo "$LATESTTAGs" | tail -${NUMTAGS})"
	fi

	if [[ ! ${LATESTTAGs} ]]; then
		nocontainer=${QUERY##*docker://}; nocontainer=${nocontainer%%-container}
		(( n = n - 1 ))
		if [[ $QUIET -eq 0 ]] || [[ $VERBOSE -eq 1 ]]; then 
			echo "[ERROR] No tags matching ${BASETAG} found for $nocontainer or ${nocontainer}-container. Is the container public and populated?"
		elif [[ $HIDE_MISSING -eq 0 ]]; then
			echo "${nocontainer}:???"
		fi
	fi
	for LATESTTAG in ${LATESTTAGs}; do
		if [[ "$REGISTRY" = *"registry.access.redhat.com"* ]]; then
			if [[ $QUIET -eq 1 ]]; then
				echo "${URLfrag%%:*}:${LATESTTAG}"
			elif [[ ${TAGONLY} -eq 1 ]]; then
				echo "${LATESTTAG}"
			else
				echo "* ${URLfrag%%:*}:${LATESTTAG} :: https://access.redhat.com/containers/#/registry.access.redhat.com/${URLfrag}/images/${LATESTTAG}"
			fi
		elif [[ "${REGISTRY}" != "" ]]; then
			if [[ $ARCHES -eq 1 ]]; then
				arches=""
				arch_string=""
				raw_inspect=$(skopeo inspect --raw "docker://${REGISTRYPRE}${URLfrag%%:*}:${LATESTTAG}")
				if echo "${raw_inspect}" | grep -q "architecture"; then 
					arches=$(echo "$raw_inspect" | yq -r .manifests[].platform.architecture)
				else
					arches="unknown (amd64 only?)"
				fi
				for arch in $arches; do arch_string="${arch_string} ${arch}"; done
				echo "${REGISTRYPRE}${URLfrag%%:*}:${LATESTTAG} ::${arch_string}"
			elif [[ ${TAGONLY} -eq 1 ]]; then
				echo "${LATESTTAG}"
			elif [[ $QUIET -eq 1 ]]; then
				konflux_add_tags=""
				if [[ $REGISTRY == "http://registry.redhat.io" ]]; then 
					konflux_add_tags="$(skopeo inspect "docker://${REGISTRYPRE}${URLfrag%%:*}:${LATESTTAG}" | jq -r '.Labels."konflux.additional-tags"' 2>/dev/null)"
					if [[ $konflux_add_tags ]]; then 
						konflux_add_tags=" (${blue}${LATESTTAG%%-*}, $konflux_add_tags${norm})"; 
					else 
						konflux_add_tags=" (${blue}${LATESTTAG%%-*}${norm})"; 
					fi
				fi
				echo -e "${REGISTRYPRE}${URLfrag%%:*}:${LATESTTAG}$konflux_add_tags"
			else
				echo "${URLfrag%%:*}:${LATESTTAG} :: ${REGISTRY}/${URLfrag%%:*}:${LATESTTAG}"
			fi
		elif [[ ${TAGONLY} -eq 1 ]]; then
			echo "${LATESTTAG}"
		else
			echo "${URLfrag}:${LATESTTAG}"
		fi

		if [[ ${PUSHTOQUAY} -eq 1 ]] && [[ ${REGISTRY} != *"quay.io"* ]]; then
			QUAYDEST="${REGISTRYPRE}${URLfrag}"; QUAYDEST=${QUAYDEST##*rhdh-}
			QUAYDEST="quay.io/rhdh/rhdh-${QUAYDEST}"

			if [[ $(skopeo --insecure-policy inspect docker://${QUAYDEST}:${LATESTTAG} 2>&1) == *"Error"* ]] || [[ ${PUSHTOQUAYFORCE} -eq 1 ]]; then 
				# CRW-1914 copy latest tag ONLY if it doesn't already exist on the registry, to prevent re-timestamping it and making it look new
				if [[ $VERBOSE -eq 1 ]]; then echo "Copy ${REGISTRYPRE}${URLfrag}:${LATESTTAG} to ${QUAYDEST}:${LATESTTAG}"; fi
				CMD="skopeo --insecure-policy copy --all docker://${REGISTRYPRE}${URLfrag}:${LATESTTAG} docker://${QUAYDEST}:${LATESTTAG}"; echo "$CMD"; $CMD
				# and update additional PUSHTOQUAYTAGS tags 
				for qtag in ${PUSHTOQUAYTAGS}; do
					if [[ $VERBOSE -eq 1 ]]; then echo "Copy ${REGISTRYPRE}${URLfrag}:${LATESTTAG} to ${QUAYDEST}:${qtag}"; fi
					CMD="skopeo --insecure-policy copy --all docker://${REGISTRYPRE}${URLfrag}:${LATESTTAG} docker://${QUAYDEST}:${qtag}"; echo "$CMD"; $CMD
				done
			else
				if [[ $VERBOSE -eq 1 ]]; then echo "Copy ${QUAYDEST}:${LATESTTAG} - already exists, nothing to do"; fi
			fi
		fi

		if [[ ${SHOWHISTORY} -eq 1 ]]; then
			if [[ $VERBOSE -eq 1 ]]; then echo "Pull ${REGISTRYPRE}${URLfrag}:${LATESTTAG} ..."; fi
			if [[ ! $(docker images | grep ${URLfrag} | grep ${LATESTTAG}) ]]; then 
				if [[ $VERBOSE -eq 1 ]]; then 
					docker pull ${REGISTRYPRE}${URLfrag}:${LATESTTAG}
				else
					docker pull ${REGISTRYPRE}${URLfrag}:${LATESTTAG} >/dev/null
				fi
			fi
			cnt=0
			IMAGE_INFO="$(docker images | grep ${URLfrag} | grep ${LATESTTAG})"
			if [[ $VERBOSE -eq 1 ]]; then echo $IMAGE_INFO; fi
			for bits in $IMAGE_INFO; do 
				let cnt=cnt+1
				if [[ ${cnt} -eq 3 ]]; then 
					# echo "Image ID = ${bits}"
					docker run -v /var/run/docker.sock:/var/run/docker.sock --rm laniksj/dfimage ${bits} # | grep FROM
					break
				fi
			done
			if [[ $VERBOSE -eq 1 ]]; then echo "Purge ${REGISTRYPRE}${URLfrag}:${LATESTTAG} ..."; fi
			docker image rm -f ${REGISTRYPRE}${URLfrag}:${LATESTTAG} >/dev/null
		fi
	done
	if [[ $NUMTAGS -gt 1 ]] || [[ ${SHOWHISTORY} -eq 1 ]]; then echo ""; fi
done
if [[ $c -gt 4 ]] && [[ $c -gt $n ]] && [[ $HIDE_MISSING -eq 0 ]]; then echo; echo "Found $n of $c containers"; fi
