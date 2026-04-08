#!/usr/bin/env bash
#
# Copyright (c) Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# Post-GA release verification for RHDH.
# Validates containers on registry.redhat.io, plugin catalog on
# registry.access.redhat.com, FBC releases via Konflux (oc), Helm chart PRs,
# GitHub/GitLab tags, release PRs from tagRelease.sh, and community image.
# Default output: failures only. Use --verbose to see passing checks.
#
# Usage:  ./checkGARelease.sh -v 1.9.0 [--plugin-regex orchestrator] [--verbose]

set -o pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" || exit; pwd)

# ── colours ──────────────────────────────────────────────────────────
norm="\033[0;39m"
green="\033[1;32m"
red="\033[1;31m"
blue="\033[1;34m"
yellow="\033[1;33m"

# ── defaults ─────────────────────────────────────────────────────────
GA_VERSION=""
PLUGIN_REGEX=""
SKIP_FBC=0
SKIP_CHART_PRS=0
VERBOSE=0

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
OPEN_COUNT=0

# ── usage ────────────────────────────────────────────────────────────
usage() {
    echo "Usage:

Post-GA verification for RHDH. Default: only failures shown.

    $0 -v VERSION [OPTIONS]

Options:
    -v VERSION           GA version to verify (e.g. 1.9.0)  [required]
    --plugin-regex RE    Check plugin images matching regex (e.g. 'orchestrator')
    --skip-fbc           Skip FBC release checks (requires oc login to Konflux)
    --skip-chart-prs     Skip Helm chart PR merge checks
    --verbose            Show all checks (pass + fail); default shows failures only
    -h, --help           This help

Prerequisites: skopeo, jq, gh, curl, git, oc (for FBC checks)
Optional:      podman (for --plugin-regex)

Examples:
    $0 -v 1.9.0
    $0 -v 1.9.2 --plugin-regex orchestrator --verbose
    $0 -v 1.9.0 --skip-fbc
"
}

# ── arg parse ────────────────────────────────────────────────────────
while [[ "$#" -gt 0 ]]; do
    case $1 in
        '-v')              GA_VERSION="$2"; shift 2;;
        '--plugin-regex')  PLUGIN_REGEX="$2"; shift 2;;
        '--skip-fbc')      SKIP_FBC=1; shift;;
        '--skip-chart-prs') SKIP_CHART_PRS=1; shift;;
        '--verbose')       VERBOSE=1; shift;;
        '-h'|'--help')     usage; exit 0;;
        *)                 echo "Unknown option: $1"; usage; exit 1;;
    esac
done

if [[ -z "$GA_VERSION" ]]; then usage; exit 1; fi

# 1.9.2 → XY=1.9, XY_DASH=1-9, FULL_DASH=1-9-2
RHDH_XY="${GA_VERSION%.*}"
RHDH_XY_DASH="${RHDH_XY//./-}"
RHDH_FULL_DASH="${GA_VERSION//./-}"

# ── prerequisite checks ─────────────────────────────────────────────
check_prerequisites() {
    local fail=0
    for cmd in skopeo jq gh curl git; do
        if ! command -v "$cmd" &>/dev/null; then
            echo -e "${red}[ERROR] Required command not found: ${cmd}${norm}"
            fail=1
        fi
    done
    if [[ $SKIP_FBC -eq 0 ]]; then
        if ! command -v oc &>/dev/null; then
            echo -e "${red}[ERROR] oc is required for FBC checks (use --skip-fbc to skip)${norm}"
            fail=1
        elif ! oc whoami &>/dev/null 2>&1; then
            echo -e "${red}[ERROR] Not logged into Konflux cluster (oc whoami failed). Run oc login or use --skip-fbc${norm}"
            fail=1
        fi
    fi
    if [[ ! -f "${SCRIPT_DIR}/release-repos.yaml" ]]; then
        echo -e "${red}[ERROR] Required file not found: ${SCRIPT_DIR}/release-repos.yaml${norm}"
        fail=1
    elif [[ ! -r "${SCRIPT_DIR}/release-repos.yaml" ]]; then
        echo -e "${red}[ERROR] Required file is not readable: ${SCRIPT_DIR}/release-repos.yaml${norm}"
        fail=1
    fi
    if [[ ! -f "${SCRIPT_DIR}/ocp-versions.yaml" ]]; then
        echo -e "${red}[ERROR] Required file not found: ${SCRIPT_DIR}/ocp-versions.yaml${norm}"
        fail=1
    elif [[ ! -r "${SCRIPT_DIR}/ocp-versions.yaml" ]]; then
        echo -e "${red}[ERROR] Required file is not readable: ${SCRIPT_DIR}/ocp-versions.yaml${norm}"
        fail=1
    fi
    if [[ -n "$PLUGIN_REGEX" ]] && ! command -v podman &>/dev/null; then
        echo -e "${red}[ERROR] podman is required for --plugin-regex${norm}"
        fail=1
    fi
    if [[ $fail -eq 0 ]]; then
        local gh_repos gl_repos ocp_versions
        gh_repos=$(get_github_repos)
        gl_repos=$(get_gitlab_repos)
        ocp_versions=$(get_ocp_versions)
        if [[ -z "${gh_repos// }" ]]; then
            echo -e "${red}[ERROR] No github_repos found in ${SCRIPT_DIR}/release-repos.yaml${norm}"
            fail=1
        fi
        if [[ -z "${gl_repos// }" ]]; then
            echo -e "${red}[ERROR] No gitlab_repos found in ${SCRIPT_DIR}/release-repos.yaml${norm}"
            fail=1
        fi
        if [[ -z "${ocp_versions// }" ]]; then
            echo -e "${red}[ERROR] No OCP versions found in ${SCRIPT_DIR}/ocp-versions.yaml${norm}"
            fail=1
        fi
    fi
    if [[ $fail -eq 1 ]]; then
        echo -e "${red}Fix the above errors and retry.${norm}"
        exit 2
    fi
}

# ── helpers ──────────────────────────────────────────────────────────

record_pass() {
    local msg="$1"
    (( PASS_COUNT++ ))
    if [[ $VERBOSE -eq 1 ]]; then echo -e "${green}[PASS]${norm} $msg"; fi
}

record_fail() {
    local msg="$1"
    (( FAIL_COUNT++ ))
    echo -e "${red}[FAIL]${norm} $msg"
}

record_skip() {
    local msg="$1"
    (( SKIP_COUNT++ ))
    if [[ $VERBOSE -eq 1 ]]; then echo -e "${yellow}[SKIP]${norm} $msg"; fi
}

record_open() {
    local msg="$1"
    (( OPEN_COUNT++ ))
    echo -e "${yellow}[OPEN]${norm} $msg"
}

section() {
    if [[ $VERBOSE -eq 1 ]]; then echo -e "\n${blue}── $1 ──${norm}"; fi
}

skopeo_check() {
    local ref="$1"
    for attempt in 1 2 3; do
        if skopeo inspect "docker://${ref}" &>/dev/null; then
            return 0
        fi
        if [[ $attempt -lt 3 ]]; then sleep 2; fi
    done
    return 1
}

get_ocp_versions() {
    local base
    base=$(grep 'OCP_VERSION_BASE:' "${SCRIPT_DIR}/ocp-versions.yaml" | sed 's/.*: *"\(.*\)"/\1/')
    echo "$base"
    sed -n '/^SUPPORTED_VERSIONS:/,/^[A-Z]/{ /^ *- /s/.*"\([^"]*\)".*/\1/p; }' "${SCRIPT_DIR}/ocp-versions.yaml"
}

get_github_repos() {
    sed -n '/^github_repos:/,/^[a-z]/{ /^ *- /s/.*"\([^"]*\)".*/\1/p; }' "${SCRIPT_DIR}/release-repos.yaml"
}

get_github_repos_no_tag() {
    sed -n '/^github_repos_no_tag:/,/^[a-z]/{ /^ *- /s/.*"\([^"]*\)".*/\1/p; }' "${SCRIPT_DIR}/release-repos.yaml"
}

get_gitlab_repos() {
    sed -n '/^gitlab_repos:/,/^[a-z]/{ /^ *- /s/.*"\([^"]*\)".*/\1/p; }' "${SCRIPT_DIR}/release-repos.yaml"
}

# ── 1. Container images on registry.redhat.io ───────────────────────

check_container_images() {
    section "Container images on registry.redhat.io"

    local images=("rhdh-hub-rhel9" "rhdh-rhel9-operator" "rhdh-operator-bundle")
    local tags=("${RHDH_XY}" "${GA_VERSION}")

    for img in "${images[@]}"; do
        for tag in "${tags[@]}"; do
            local ref="registry.redhat.io/rhdh/${img}:${tag}"
            if skopeo_check "${ref}"; then
                record_pass "Container ${img}:${tag}"
            else
                record_fail "Container ${img}:${tag} -- not found on registry.redhat.io"
            fi
        done
    done
}

# ── 2. Plugin catalog index on registry.access.redhat.com ───────────

check_plugin_catalog_index() {
    section "Plugin catalog index on registry.access.redhat.com"

    for tag in "${RHDH_XY}" "${GA_VERSION}"; do
        local ref="registry.access.redhat.com/rhdh/plugin-catalog-index:${tag}"
        if skopeo_check "${ref}"; then
            record_pass "Plugin catalog index: ${ref}"
        else
            record_fail "Plugin catalog index not found: ${ref}"
        fi
    done
}

# ── 3. FBC releases verified via Konflux Release CRs ────────────────

check_fbc_releases() {
    section "FBC prod releases (Konflux)"

    if [[ $SKIP_FBC -eq 1 ]]; then
        local ocp_versions n=0
        ocp_versions=$(get_ocp_versions)
        for _ in $ocp_versions; do (( n++ )); done
        SKIP_COUNT=$(( SKIP_COUNT + n ))
        if [[ $VERBOSE -eq 1 ]]; then echo -e "${yellow}[SKIP]${norm} FBC checks skipped (${n} OCP versions)"; fi
        return
    fi

    local releases_json
    releases_json=$(oc -n rhdh-tenant get Releases --sort-by=.metadata.creationTimestamp -o json 2>/dev/null)
    if [[ -z "$releases_json" ]] || ! echo "$releases_json" | jq empty 2>/dev/null; then
        record_fail "Could not fetch Releases from Konflux (oc -n rhdh-tenant get Releases failed)"
        return
    fi

    local ocp_versions
    ocp_versions=$(get_ocp_versions)
    if [[ $VERBOSE -eq 1 ]]; then
        echo -e "${blue}[INFO]${norm} Using OCP versions from ocp-versions.yaml: ${ocp_versions//$'\n'/ }"
    fi

    for ocp_ver in $ocp_versions; do
        local ocp_dash="${ocp_ver//./-}"
        local rp="rhdh-${RHDH_XY_DASH}-fbc-${ocp_dash}-prod-release-plan"
        local rn_prefix="release-rhdh-${RHDH_FULL_DASH}-fbc-${ocp_dash}-prod-"

        local succeeded
        succeeded=$(echo "$releases_json" | jq -r \
            --arg rp "$rp" --arg pfx "$rn_prefix" \
            '[.items[]
              | select(.spec.releasePlan == $rp)
              | select(.metadata.name | startswith($pfx))
              | select(.status.conditions[]? | .type=="Released" and .status=="True")
            ] | last | .metadata.name // empty' 2>/dev/null)

        if [[ -n "$succeeded" ]]; then
            local release_url="https://konflux-ui.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/ns/rhdh-tenant/applications/fbc-${ocp_dash}/releases/${succeeded}"
            record_pass "FBC ${ocp_ver} prod release: ${succeeded} (${release_url})"
        else
            local latest
            latest=$(echo "$releases_json" | jq -r \
                --arg rp "$rp" --arg pfx "$rn_prefix" \
                '[.items[]
                  | select(.spec.releasePlan == $rp)
                  | select(.metadata.name | startswith($pfx))
                ] | last | .metadata.name // empty' 2>/dev/null)

            if [[ -n "$latest" ]]; then
                local reason
                reason=$(echo "$releases_json" | jq -r \
                    --arg name "$latest" \
                    '.items[] | select(.metadata.name == $name)
                     | (.status.conditions[]? | select(.type=="Released") | .reason) // "InProgress"' 2>/dev/null | head -1)
                record_fail "FBC ${ocp_ver} prod release not succeeded: ${latest} (${reason})"
            else
                record_fail "FBC ${ocp_ver} prod release not found (expected Release CR matching ${rn_prefix}*)"
            fi
        fi
    done
}

# ── 4. Helm chart PRs merged ────────────────────────────────────────

check_chart_prs() {
    section "Helm chart PRs (openshift-helm-charts/charts)"

    if [[ $SKIP_CHART_PRS -eq 1 ]]; then
        record_skip "Chart PR checks skipped (--skip-chart-prs)"
        return
    fi

    local merged_count=0
    local unmerged=()

    while IFS= read -r pr_json; do
        [[ -z "$pr_json" ]] && continue
        local state title url
        state=$(echo "$pr_json" | jq -r '.state')
        title=$(echo "$pr_json" | jq -r '.title')
        url=$(echo "$pr_json" | jq -r '.url')
        if [[ "$state" == "MERGED" ]]; then
            (( merged_count++ ))
        else
            unmerged+=("${title} (${state}) ${url}")
        fi
    done < <(gh pr list --repo openshift-helm-charts/charts \
        --search "author:rhdh-bot ${GA_VERSION} in:title" \
        --state all --json state,title,url --jq '.[]|@json' 2>/dev/null)

    for u in "${unmerged[@]}"; do
        record_fail "Chart PR not merged: ${u}"
    done

    if [[ $merged_count -ge 2 ]]; then
        record_pass "Chart PRs merged: ${merged_count} by rhdh-bot for ${GA_VERSION}"
    elif [[ $merged_count -gt 0 ]]; then
        record_fail "Only ${merged_count}/2 chart PRs merged (expected 2 for rhdh + orchestrator-infra)"
    elif [[ ${#unmerged[@]} -eq 0 ]]; then
        record_fail "No chart PRs found for rhdh-bot + ${GA_VERSION}"
    fi
}

# ── 5. GitHub tags ──────────────────────────────────────────────────

check_github_tags() {
    section "GitHub tags"

    local repos no_tag_repos
    repos=$(get_github_repos)
    no_tag_repos=$(get_github_repos_no_tag)

    for repo in $repos; do
        if echo "$no_tag_repos" | grep -qx "$repo"; then
            continue
        fi
        if gh api "repos/${repo}/git/ref/tags/${GA_VERSION}" &>/dev/null; then
            record_pass "GitHub tag: ${repo} @ ${GA_VERSION}"
        else
            record_fail "GitHub tag missing: ${repo} @ ${GA_VERSION}"
        fi
    done
}

# ── 6. GitLab tags ──────────────────────────────────────────────────

check_gitlab_tags() {
    section "GitLab tags"

    local repos
    repos=$(get_gitlab_repos)

    for repo in $repos; do
        if git ls-remote --tags "git@gitlab.cee.redhat.com:${repo}.git" "${GA_VERSION}" 2>/dev/null | grep -q "${GA_VERSION}"; then
            record_pass "GitLab tag: ${repo} @ ${GA_VERSION}"
        else
            record_fail "GitLab tag missing: ${repo} @ ${GA_VERSION}"
        fi
    done
}

# ── 7. Release PRs from tagRelease.sh ──────────────────────────────

check_release_prs() {
    section "Release PRs (tagRelease.sh version bumps)"

    # After tagging x.y.z, tagRelease.sh bumps release branches to x.y.(z+1)
    local next_z=""
    if [[ $GA_VERSION =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
        next_z="${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.$((BASH_REMATCH[3] + 1))"
    fi
    if [[ -z "$next_z" ]]; then
        record_fail "Cannot compute next .z version from ${GA_VERSION}"
        return
    fi

    # GitHub: version-bump PRs on release-1.y branches
    local gh_repos_to_check=("redhat-developer/rhdh" "redhat-developer/rhdh-operator")
    for repo in "${gh_repos_to_check[@]}"; do
        _check_gh_release_pr "$repo" "$next_z"
    done

    # GitLab: konflux-release-data RPA update MR
    _check_krd_release_mr "$next_z"
}

_check_gh_release_pr() {
    local repo="$1"
    local bump_version="$2"
    local search_url="https://github.com/${repo}/pulls?q=is%3Apr+author%3Arhdh-bot+tagRelease.sh+${RHDH_XY}"

    local pr_json
    pr_json=$(gh pr list --repo "$repo" \
        --search "author:rhdh-bot \"bump to ${bump_version}\"" \
        --state all --json state,title,url --jq '.[0]' 2>/dev/null)

    if [[ -z "$pr_json" ]] || [[ "$pr_json" == "null" ]]; then
        record_fail "Release PR not found: ${repo} -- search: ${search_url}"
        return
    fi

    local state url
    state=$(echo "$pr_json" | jq -r '.state')
    url=$(echo "$pr_json" | jq -r '.url')

    case "$state" in
        MERGED)  record_pass "Release PR merged: ${repo} (${url})" ;;
        OPEN)    record_open "Release PR still open: ${repo} (${url})" ;;
        *)       record_fail "Release PR ${state}: ${repo} (${url})" ;;
    esac
}

_check_krd_release_mr() {
    local bump_version="$1"
    local krd_search_url="https://gitlab.cee.redhat.com/releng/konflux-release-data/-/merge_requests?scope=all&search=rhdh-${RHDH_XY_DASH}+RPAs"

    # Attempt GitLab API check (requires Kerberos or token auth)
    local mr_json
    mr_json=$(curl -ks --negotiate -u: \
        "https://gitlab.cee.redhat.com/api/v4/projects/releng%2Fkonflux-release-data/merge_requests?search=rhdh-${RHDH_XY_DASH}+RPAs&state=all&per_page=10" 2>/dev/null)

    if [[ -n "$mr_json" ]] && echo "$mr_json" | jq -e 'type == "array"' &>/dev/null; then
        local match
        match=$(echo "$mr_json" | jq -r --arg ver "$bump_version" \
            '[.[] | select(.title | contains($ver))] | sort_by(.created_at) | last // empty' 2>/dev/null)

        if [[ -n "$match" ]] && [[ "$match" != "null" ]] && [[ "$match" != "" ]]; then
            local state mr_url
            state=$(echo "$match" | jq -r '.state')
            mr_url=$(echo "$match" | jq -r '.web_url')

            case "$state" in
                merged)  record_pass "KRD release MR merged: releng/konflux-release-data (${mr_url})" ;;
                opened)  record_open "KRD release MR still open: releng/konflux-release-data (${mr_url})" ;;
                *)       record_fail "KRD release MR ${state}: releng/konflux-release-data (${mr_url})" ;;
            esac
            return
        fi
    fi

    # API check failed or no match found
    record_fail "KRD release MR not found: releng/konflux-release-data -- search: ${krd_search_url}"
}

# ── 8. Community image ──────────────────────────────────────────────

check_community_image() {
    section "Community image"

    local ref="quay.io/rhdh-community/rhdh:${GA_VERSION}"
    if skopeo_check "${ref}"; then
        record_pass "Community image: ${ref}"
        return
    fi

    local in_progress_runs
    in_progress_runs=$(
        {
            gh run list -R redhat-developer/rhdh -u rhdh-bot -e push -b "${GA_VERSION}" \
                -w "Build Next and Tag Image" --json url,status 2>/dev/null
            gh run list -R redhat-developer/rhdh -u rhdh-bot -e push -b "${RHDH_XY}" \
                -w "Build Next and Tag Image" --json url,status 2>/dev/null
        } | jq -r '.[] | select(.status == "in_progress") | .url' 2>/dev/null | awk '!seen[$0]++'
    )

    if [[ -n "$in_progress_runs" ]]; then
        local run_url
        run_url=$(echo "$in_progress_runs" | head -1)
        record_skip "Community image build in progress: ${run_url}"
    else
        record_fail "Community image not found: ${ref} -- check GH Action: https://github.com/redhat-developer/rhdh/actions/workflows/next-build-image.yaml?query=event%3Apush+actor%3Arhdh-bot"
    fi
}

# ── 9. Plugin images (optional, via --plugin-regex) ──────────────────

check_plugin_images() {
    if [[ -z "$PLUGIN_REGEX" ]]; then
        return
    fi

    section "Plugin images (regex: ${PLUGIN_REGEX})"

    local plugin_names=()
    local tmpdir
    tmpdir=$(mktemp -d)
    trap 'rm -rf "$tmpdir"' RETURN

    local cid
    cid=$(podman create --platform linux/amd64 "registry.access.redhat.com/rhdh/plugin-catalog-index:${GA_VERSION}" 2>/dev/null) || true
    if [[ -z "$cid" ]]; then
        record_fail "Could not pull plugin-catalog-index:${GA_VERSION} from registry.access.redhat.com"
        return
    fi
    podman cp "${cid}:/index.json" "${tmpdir}/index.json" 2>/dev/null
    podman rm "$cid" &>/dev/null || true

    if [[ ! -f "${tmpdir}/index.json" ]]; then
        record_fail "Could not extract /index.json from plugin-catalog-index:${GA_VERSION}"
        return
    fi

    while IFS= read -r name; do
        plugin_names+=("$name")
    done < <(jq -r 'to_entries[] | select(.key | test("'"${PLUGIN_REGEX}"'")) | .key' "${tmpdir}/index.json" 2>/dev/null)

    if [[ ${#plugin_names[@]} -eq 0 ]]; then
        record_fail "No plugins matching '${PLUGIN_REGEX}' in plugin-catalog-index:${GA_VERSION}"
        return
    fi

    for plugin in "${plugin_names[@]}"; do
        local exact_tag="${GA_VERSION}"
        if skopeo_check "registry.access.redhat.com/rhdh/${plugin}:${exact_tag}"; then
            record_pass "Plugin ${plugin}:${exact_tag}"
        else
            record_fail "Plugin ${plugin}:${exact_tag} not found on registry.access.redhat.com"
        fi
    done
}

# ── summary ─────────────────────────────────────────────────────────

print_summary() {
    local total=$(( PASS_COUNT + FAIL_COUNT + SKIP_COUNT + OPEN_COUNT ))

    echo ""
    echo -e "${blue}───────────────────────────────────────────────────────────${norm}"
    if [[ $FAIL_COUNT -eq 0 ]] && [[ $OPEN_COUNT -eq 0 ]]; then
        echo -e "  ${green}RHDH ${GA_VERSION}: all ${PASS_COUNT} checks passed${norm} (${SKIP_COUNT} skipped)"
    elif [[ $FAIL_COUNT -eq 0 ]]; then
        echo -e "  ${yellow}RHDH ${GA_VERSION}: ${OPEN_COUNT} OPEN${norm}, ${PASS_COUNT} passed, ${SKIP_COUNT} skipped  (${total} total)"
    else
        echo -e "  ${red}RHDH ${GA_VERSION}: ${FAIL_COUNT} FAILED${norm}, ${OPEN_COUNT} open, ${PASS_COUNT} passed, ${SKIP_COUNT} skipped  (${total} total)"
    fi
    echo -e "${blue}───────────────────────────────────────────────────────────${norm}"
}

# ── main ─────────────────────────────────────────────────────────────

check_prerequisites

echo -e "${blue}Verifying RHDH ${GA_VERSION} GA release...${norm}"

check_container_images
check_plugin_catalog_index
check_fbc_releases
check_chart_prs
check_github_tags
check_gitlab_tags
check_release_prs
check_community_image
check_plugin_images

print_summary

if [[ $FAIL_COUNT -gt 0 ]]; then
    exit 1
fi
exit 0
