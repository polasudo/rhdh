#!/bin/bash
# secrets-dropin.sh — Generate Quadlet drop-in files for Podman secrets
#
# Drop-in location:
#   /etc/containers/systemd/<service>.container.d/secrets.conf
#
# Usage:
#   source secrets-dropin.sh
#   generate_secrets_dropin "rhdh"      # generates rhdh.container.d/secrets.conf
#   generate_secrets_dropin "postgres"   # generates postgres.container.d/secrets.conf

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

# RHDH container secrets
# POSTGRES_PASSWORD and BACKEND_DATABASE_CONNECTION_PASSWORD both use
# the admin password secret but target different env var names
declare -A RHDH_SECRETS=(
    [BACKEND_SECRET]="rhdh_backend_secret,type=env,target=BACKEND_SECRET"
    [POSTGRESQL_ADMIN_PASSWORD]="rhdh_postgresql_admin_password,type=env,target=POSTGRES_PASSWORD"
    [BACKEND_DATABASE_CONNECTION_PASSWORD]="rhdh_postgresql_admin_password,type=env,target=BACKEND_DATABASE_CONNECTION_PASSWORD"
    [GITHUB_TOKEN]="rhdh_github_token,type=env,target=GITHUB_TOKEN"
    [GITHUB_CLIENT_ID]="rhdh_github_client_id,type=env,target=GITHUB_CLIENT_ID"
    [GITHUB_CLIENT_SECRET]="rhdh_github_client_secret,type=env,target=GITHUB_CLIENT_SECRET"
    [GITLAB_TOKEN]="rhdh_gitlab_token,type=env,target=GITLAB_TOKEN"
)

# PostgreSQL container secrets
declare -A POSTGRES_SECRETS=(
    [POSTGRESQL_PASSWORD]="rhdh_postgresql_password,type=env,target=POSTGRESQL_PASSWORD"
    [POSTGRESQL_ADMIN_PASSWORD]="rhdh_postgresql_admin_password,type=env,target=POSTGRESQL_ADMIN_PASSWORD"
)

_load_dropin_container_secrets() {
    local helper="${SCRIPT_DIR}/yaml-helper.py"
    [[ -f "$helper" ]] || return 0
    local line key value
    while IFS='=' read -r key value; do
        [[ -n "$key" && -n "$value" ]] || continue
        RHDH_SECRETS["$key"]="$value"
    done < <(python3 "$helper" list-container-secrets rhdh 2>/dev/null)
    while IFS='=' read -r key value; do
        [[ -n "$key" && -n "$value" ]] || continue
        POSTGRES_SECRETS["$key"]="$value"
    done < <(python3 "$helper" list-container-secrets postgres 2>/dev/null)
}
_load_dropin_container_secrets

generate_secrets_dropin() {
    local container_name="$1"
    local dropin_dir="/etc/containers/systemd/${container_name}.container.d"
    local dropin_file="${dropin_dir}/secrets.conf"

    local -n secret_map
    case "$container_name" in
        rhdh)     secret_map=RHDH_SECRETS ;;
        postgres) secret_map=POSTGRES_SECRETS ;;
        *)
            log_error "Unknown container: $container_name"
            return 1
            ;;
    esac

    mkdir -p "$dropin_dir"

    local content="[Container]"
    local has_secrets=false

    for key in "${!secret_map[@]}"; do
        if rhdh_secret_exists "$key"; then
            content+=$'\n'"Secret=${secret_map[$key]}"
            has_secrets=true
        fi
    done

    if $has_secrets; then
        echo "$content" > "$dropin_file"
        chmod 644 "$dropin_file"
        log_info "Generated secrets drop-in: $dropin_file"
    else
        rm -f "$dropin_file"
        log_info "No secrets found for $container_name — removed drop-in"
    fi
}

generate_config_dropin() {
    local dropin_dir="/etc/containers/systemd/rhdh.container.d"
    local dropin_file="${dropin_dir}/config.conf"

    mkdir -p "$dropin_dir"

    local content="[Container]"
    local has_overrides=false

    local arg key val
    for arg in "$@"; do
        key="${arg%%=*}"
        val="${arg#*=}"
        val="${val//$'\n'/}"
        val="${val//$'\r'/}"
        [[ -z "$key" || -z "$val" ]] && continue
        content+=$'\n'"Environment=${key}=${val}"
        has_overrides=true
    done

    if $has_overrides; then
        echo "$content" > "$dropin_file"
        chmod 644 "$dropin_file"
        log_info "Generated config drop-in: $dropin_file"
    else
        rm -f "$dropin_file"
    fi
}

generate_postgres_config_dropin() {
    local dropin_dir="/etc/containers/systemd/postgres.container.d"
    local dropin_file="${dropin_dir}/config.conf"
    local helper="/usr/local/lib/rhdh/yaml-helper.py"
    local prod_yaml="$RHDH_APP_CONFIG_PRODUCTION"
    local base_yaml="$RHDH_APP_CONFIG"

    mkdir -p "$dropin_dir"

    local db_user=""
    local db_name=""

    if [[ -f "$prod_yaml" ]]; then
        db_user=$(python3 "$helper" read "$prod_yaml" "backend.database.connection.user" 2>/dev/null) || true
        db_name=$(python3 "$helper" read "$prod_yaml" "backend.database.connection.database" 2>/dev/null) || true
    fi
    if [[ -z "$db_user" && -f "$base_yaml" ]]; then
        db_user=$(python3 "$helper" read "$base_yaml" "backend.database.connection.user" 2>/dev/null) || true
    fi
    if [[ -z "$db_name" && -f "$base_yaml" ]]; then
        db_name=$(python3 "$helper" read "$base_yaml" "backend.database.connection.database" 2>/dev/null) || true
    fi

    db_user="${db_user:-rhdh_user}"
    db_name="${db_name:-rhdh_backstage}"

    local content="[Container]"
    content+=$'\n'"Environment=POSTGRESQL_USER=${db_user}"
    content+=$'\n'"Environment=POSTGRESQL_DATABASE=${db_name}"

    echo "$content" > "$dropin_file"
    chmod 644 "$dropin_file"
    log_info "Generated postgres config drop-in: $dropin_file (user=${db_user}, db=${db_name})"
}

validate_dropin_secrets() {
    local container_name="$1"
    local dropin_file="/etc/containers/systemd/${container_name}.container.d/secrets.conf"
    local has_errors=false

    if [[ ! -f "$dropin_file" ]]; then
        return 0
    fi

    while IFS= read -r line; do
        if [[ "$line" =~ ^Secret=([^,]+), ]]; then
            local secret_name="${BASH_REMATCH[1]}"
            if ! podman secret inspect "$secret_name" &>/dev/null; then
                log_error "Secret '$secret_name' referenced in $dropin_file but not found in Podman"
                has_errors=true
            fi
        fi
    done < "$dropin_file"

    $has_errors && return 1 || return 0
}
