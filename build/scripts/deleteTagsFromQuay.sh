#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# script to delete tags  from the quay.io/rhdh/ repos

VERBOSE=0
PAGE=1 # start on page 1 by default -- might be more efficient to skip to page 90 or so
DELETE_AGE="-8 months" # age at which to delete tags
REPOS="rhdh-hub-rhel9 rhdh-rhel9-operator rhdh-operator-bundle iib"
FILTER="" 
DRYRUN=0 # don't actually do anything

usage() {
if [[ ! $accessToken ]]; then 
  echo "
You must export your Quay API access token to run this script. To create a new token, go to 
  https://quay.io/organization/rhdh/application/RRFWLY26BL7VCM6WQAK9?tab=gen-token

Then:
  export accessToken=..."
fi
echo "
Usage:
  $0 [-p START_PAGE] [-r REPOS] [--filter PATTERN] [--age AGE] [--dry-run] [--debug]

Examples:

  # start on page 44
  $0 -p 44 --dry-run --debug 

  # remove 1.3- tags
  $0 --filter 1.3- --dry-run --debug 

  # remove on-pr and on-push tags, which duplicate the numbered ones 1.y-zzz
  $0 --filter on- --age '10 days'

  # remove old konflux-generated tags for .sbom, .src, .att, etc. 
  $0 --filter sha256- --age '4 months'

  # remove helm chart CI tags
  $0 -r chart --filter CI --age '14 days'

Options:
    -p PAGE             start searching for old tags on specified page; default $PAGE
    -r REPOS            space-separated list of repos to process; default '$REPOS'
    --filter FILTER     search only for tags matching some pattern, like 1.3-, on-, or sha256-
    --age AGE           delete tags older than some number of months; default: 8 months
    --all               default (slowest) operation: no filter, starting on page $PAGE
    --dry-run           show commands but do not delete any tags
    --debug             more verbose console output
    -h, --help          this help
"
}

if [[ "$#" -lt 2 ]] || [[ ! $accessToken ]]; then usage; exit 1; fi

# commandline args
while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-p') PAGE="$2"; shift 1;; # 1.y 
    '-r') REPOS="$2"; shift 1;;
    '--age') DELETE_AGE="-${2}"; shift 1;;
    '--filter') FILTER="$2"; FILTER="&filter_tag_name=like:${FILTER}"; shift 1;; # 1.y 
    '--all') FILTER=""; PAGE=1;;
    '--dry-run') DRYRUN=1;;
    '-h'|'--help') usage;;
    '--debug') VERBOSE=1;;
    *) echo "Unknown parameter used: $1."; usage; exit 1;;
  esac
  shift 1
done

totaldeleted=0
for repo in $REPOS; do
  thisdeleted=0
  json=$(mktemp)

  if [[ $repo != "chart" ]]; then # can't inspect helm charts, only containers
    repoAndTag="${repo}:next"
    if [[ $repo == "iib" ]]; then 
      repoAndTag="${repo}:next-v4.18-x86_64" # no latest tag in this repo
    fi
    echo -e -n "\nTags read from $repo : "; time skopeo inspect "docker://quay.io/rhdh/${repoAndTag}" | jq .RepoTags | wc -l
  fi

  if [[ $VERBOSE -eq 1 ]]; then echo -e "Clean up tags from quay.io/rhdh/$repo using tmp file $json"; fi
  page=$PAGE
  echo "Read https://quay.io/api/v1/repository/rhdh/${repo}/tag/?limit=100&onlyActiveTags=true${FILTER}&page=${page} "
  curl -sS "https://quay.io/api/v1/repository/rhdh/${repo}/tag/?limit=100&onlyActiveTags=true${FILTER}&page=${page}" > "$json"
  if [[ $((page % 5)) -eq 0 ]] && [[ $VERBOSE -eq 0 ]]; then echo -n "."; fi # add a dot every 5 pages
  while [[ $(jq '.tags' "$json") != "" ]] && [[ $(jq '.tags' "$json") != "[]" ]]; do
    index=0
    while [[ $(jq ".tags[$index]" "$json") != null ]]; do
      tag_date=$(jq ".tags[$index].last_modified" "$json")
      tag_date=$(echo "$tag_date" | xargs)
      epoch_tag_date=$(date -d "${tag_date}" +"%s")
      epoch_xmo_ago=$(date -d "$DELETE_AGE" +"%s")
      if [[ $epoch_xmo_ago -ge $epoch_tag_date ]]; then
        tag_name=$(jq -r ".tags[$index].name" "$json")
        # shellcheck disable=SC2089
        CMD=(curl -sS -H "Authorization: Bearer ${accessToken}" -X DELETE "https://quay.io/api/v1/repository/rhdh/${repo}/tag/${tag_name}")
        if [[ $DRYRUN -eq 1 ]]; then
          echo "  [$index / $page]" "${CMD[@]}" "(updated ${tag_date})" # > /tmp/log
        else
          "${CMD[@]}"
          echo "  [$index / $page] Deleted ${tag_name} from ${repo} (updated ${tag_date})"
        fi
        totaldeleted=$(( totaldeleted + 1 ))
        thisdeleted=$(( thisdeleted + 1 ))
      fi
      index=$(( index + 1 ))
    done
    page=$(( page + 1 ))
    if [[ $((page % 5)) -eq 0 ]] && [[ $VERBOSE -eq 0 ]]; then echo -n "."; fi # add a dot every 5 pages
    if [[ $VERBOSE -eq 1 ]]; then echo -e "Read https://quay.io/api/v1/repository/rhdh/${repo}/tag/?limit=100&onlyActiveTags=true${FILTER}&page=${page}"; fi
    curl -sS "https://quay.io/api/v1/repository/rhdh/${repo}/tag/?limit=100&onlyActiveTags=true${FILTER}&page=${page}" > "$json"
  done
  page=$(( page - 1 ))
  echo -e "\nRepo $repo processed to page $page; tags deleted: $thisdeleted\n"
  rm -f "$json"
done
echo -e "\nTotal tags deleted: $totaldeleted"
