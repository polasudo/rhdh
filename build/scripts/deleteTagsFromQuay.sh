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
USE_PLUGINS=0
LIST_PLUGINS_REPOS_ONLY=0
PLUGIN_SUBSTR="plugin"

QUAY_TOKEN="${QUAY_TOKEN:-${QUAY_APP_ACCESS_TOKEN:-}}"

usage() {
if [[ ! $QUAY_TOKEN ]]; then 
  echo "
You must export your Quay API access token to run this script. To create a new token, go to 
  https://quay.io/organization/rhdh/application/RRFWLY26BL7VCM6WQAK9?tab=gen-token

Then:
  export QUAY_TOKEN=..."
fi
echo "
Usage:
  $0 [-p START_PAGE] [-r REPOS] [--filter PATTERN] [--age AGE] [--dry-run] [--debug] [--plugins] [--list-plugins-repos]

Examples:

  # start on page 44
  $0 -p 44 --dry-run --debug 

  # remove 1.3- tags
  $0 --filter 1.3- --dry-run --debug 

  # remove on-pr and on-push tags, which duplicate the numbered ones 1.y-zzz
  $0 --filter on- --age '10 days'

  # remove old konflux-generated tags for .sbom, .src, .att, etc. 
  $0 --filter sha256- --age '4 months'

  # remove old tags from quay.io/rhdh/*plugin* repos in addition to the default repos
  $0 --filter sha256- --age '8 months' --plugins

  # remove helm chart CI tags
  $0 -r chart --filter CI --age '14 days'

Options:
    -p PAGE             start searching for old tags on specified page; default $PAGE
    -r REPOS            space-separated list of repos to process; default '$REPOS'
    --plugins           include quay.io/rhdh/*plugin* repos to process
    --list-plugins-repos   print plugin repository names and exit
    --filter FILTER     search only for tags matching some pattern, like 1.3-, on-, or sha256-
    --age AGE           delete tags older than some number of months; default: 8 months
    --all               default (slowest) operation: no filter, starting on page $PAGE
    --dry-run           show commands but do not delete any tags
    --debug             more verbose console output
    --token             pass QUAY_TOKEN via commandline instead of using env var
    -h, --help          this help
"
}

if [[ "$#" -lt 1 ]]; then usage; exit 1; fi

# commandline args
while [[ "$#" -gt 0 ]]; do
  case $1 in
    '-p') PAGE="$2"; shift 1;; # 1.y 
    '-r') REPOS="$2"; shift 1;;
    '--age') DELETE_AGE="-${2}"; shift 1;;
    '--filter') FILTER="$2"; FILTER="&filter_tag_name=like:${FILTER}"; shift 1;; # 1.y 
    '--all') FILTER=""; PAGE=1;;
    '--dry-run') DRYRUN=1;;
    '-h'|'--help') usage; exit 0;;
    '--debug') VERBOSE=1;;
    '--token') QUAY_TOKEN="$2"; shift 1;;
    '--plugins') USE_PLUGINS=1;;
    '--list-plugins-repos') LIST_PLUGINS_REPOS_ONLY=1;;
    *) echo "Unknown parameter used: $1."; usage; exit 1;;
  esac
  shift 1
done

if [[ ! $QUAY_TOKEN ]]; then usage; exit 1; fi

# One repo name per line: quay.io/rhdh/*plugin*
list_plugins_repos() {
  local next="" url json page_filtered
  local out
  out=$(mktemp)
  while true; do
    url="https://quay.io/api/v1/repository?namespace=rhdh&limit=100&public=true&starred=false"
    [[ -n "$next" ]] && url+="&next_page=${next}"
    json=$(curl -sS -H "Authorization: Bearer ${QUAY_TOKEN}" "$url")
    [[ $VERBOSE -eq 1 ]] && echo "[DEBUG] GET $url" >&2
    page_filtered=$(echo "$json" | jq --arg s "$PLUGIN_SUBSTR" '[(.repositories // [])[] | select(.name != null) | select(.name | ascii_downcase | contains($s | ascii_downcase))] | length')
    [[ $VERBOSE -eq 1 ]] && echo "[DEBUG] matched repo count (name contains \"$PLUGIN_SUBSTR\"): $page_filtered" >&2
    echo "$json" | jq -r --arg s "$PLUGIN_SUBSTR" '
      (.repositories // [])[]
      | select(.name != null)
      | select(.name | ascii_downcase | contains($s | ascii_downcase))
      | .name' >> "$out"
    next=$(echo "$json" | jq -r '.next_page // empty')
    [[ -z "$next" ]] && break
  done
  local out_sorted="${out}.sorted"
  sort -u "$out" >"$out_sorted"
  local unique_filtered
  unique_filtered=$(wc -l <"$out_sorted" | tr -d ' \t\n')
  echo "[INFO] ${unique_filtered} repository name(s) match '${PLUGIN_SUBSTR}'." >&2
  cat "$out_sorted"
  rm -f "$out" "$out_sorted"
}

if [[ $LIST_PLUGINS_REPOS_ONLY -eq 1 ]]; then
  echo "[INFO] Plugin repositories in quay.io/rhdh with name containing '${PLUGIN_SUBSTR}':" >&2
  list_plugins_repos
  exit 0
fi

if [[ $USE_PLUGINS -eq 1 ]]; then
  discovered=$(list_plugins_repos | xargs)
  if [[ -z "$discovered" ]]; then
    echo "[WARN] No repositories matched '${PLUGIN_SUBSTR}' under namespace rhdh; continuing with REPOS only." >&2
  else
    # merge explicit/default REPOS with discovered plugin repositories
    REPOS=$(echo "$REPOS $discovered" | tr ' ' '\n' | awk '!seen[$0]++' | xargs)
    [[ $VERBOSE -eq 1 ]] && echo "[DEBUG] Full list of repositories to process, including plugin repositories: $REPOS" >&2
  fi
fi

totaldeleted=0
for repo in $REPOS; do
  thisdeleted=0
  json=$(mktemp)

  if [[ $repo != "chart" ]]; then # can't inspect helm charts, only containers
    # Plugin repos have no :next tag; tag deletion uses the Quay API only (below).
    if [[ "$repo" == *"${PLUGIN_SUBSTR}"* ]]; then
      echo -e "\nTags read from $repo : skipped (no :next on typical plugin images; using Quay tag API only)"
    else
      repoAndTag="${repo}:next"
      if [[ $repo == "iib" ]]; then
        repoAndTag="${repo}:next-v4.20-x86_64" # no plain :next in this repo
      fi
      echo -e -n "\nTags read from $repo : "
      # stderr hidden: missing manifest would otherwise print skopeo FATA; cleanup does not need inspect to succeed.
      if skopeo_out=$(skopeo inspect "docker://quay.io/rhdh/${repoAndTag}" 2>/dev/null) && [[ -n "$skopeo_out" ]]; then
        count=$(echo "$skopeo_out" | jq '.RepoTags // [] | length' 2>/dev/null) || count=""
        if [[ "$count" =~ ^[0-9]+$ ]]; then
          echo "${count} (RepoTags via skopeo)"
        else
          echo "n/a (skopeo JSON had no RepoTags)"
        fi
      else
        echo "n/a (no ${repoAndTag} manifest)"
      fi
    fi
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
        CMD=(curl -sS -H "Authorization: Bearer ${QUAY_TOKEN}" -X DELETE "https://quay.io/api/v1/repository/rhdh/${repo}/tag/${tag_name}")
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
