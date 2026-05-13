#!/bin/bash
# RHDH First-Boot Configuration
# Runs on first boot to:
# 1. Apply configuration from cloud-init user-data (if provided)
# 2. Auto-generate infrastructure secrets (if not already set)
# 3. Generate Quadlet drop-ins for Podman secret injection
#
# The admin account is LOCKED in the image (no default password).
# SSH keys must be provisioned via cloud-init at deployment.

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================
LIB_DIR="/usr/local/lib/rhdh"
source "${LIB_DIR}/common.sh"
source "${LIB_DIR}/secrets-dropin.sh"

ADMIN_USER="${ADMIN_USER:-admin}"
FIRST_BOOT_MARKER="${RHDH_CONFIG_DIR}/.first-boot-complete"

# ============================================================================
# Logging
# ============================================================================
log_header() {
    echo ""
    echo "============================================================"
    echo " $1"
    echo "============================================================"
}

# ============================================================================
# External database support — remove postgres dependency
# ============================================================================
_generate_external_db_dropins() {
    log_info "External database detected — removing PostgreSQL dependency"

    # Remove Requires=postgres.service from the RHDH Quadlet
    local rhdh_dropin_dir="/etc/containers/systemd/${RHDH_CONTAINER_NAME}.container.d"
    mkdir -p "$rhdh_dropin_dir"
    cat > "${rhdh_dropin_dir}/external-db.conf" << 'EXTEOF'
[Unit]
Requires=
After=network-online.target first-boot-config.service
EXTEOF
    chmod 644 "${rhdh_dropin_dir}/external-db.conf"
    log_info "Generated Quadlet drop-in: ${rhdh_dropin_dir}/external-db.conf"

    # Override rhdh-stack-autostart to skip postgres startup
    local autostart_dropin_dir="/etc/systemd/system/rhdh-stack-autostart.service.d"
    mkdir -p "$autostart_dropin_dir"
    printf '[Service]\nExecStart=\nExecStart=/usr/bin/bash -c '\''systemctl daemon-reload && systemctl start %s'\''\n' \
        "${RHDH_SERVICE}" > "${autostart_dropin_dir}/external-db.conf"
    chmod 644 "${autostart_dropin_dir}/external-db.conf"
    log_info "Generated systemd drop-in: ${autostart_dropin_dir}/external-db.conf"

    # Disable the bundled postgres service
    systemctl disable "${RHDH_POSTGRES_SERVICE}" 2>/dev/null || true
    systemctl stop "${RHDH_POSTGRES_SERVICE}" 2>/dev/null || true

    log_success "PostgreSQL dependency removed for external database"
}

# ============================================================================
# Apply RHDH config from a YAML file (cloud-init user-data)
# ============================================================================
apply_rhdh_config() {
    local config_file="$1"

    log_info "Applying RHDH configuration from $config_file"

    # Detect database type before processing (config_file is shredded after)
    local db_type
    db_type=$(python3 "${LIB_DIR}/yaml-helper.py" read "$config_file" "database.type" 2>/dev/null) || true
    db_type="${db_type:-builtin}"

    local -a config_dropins=()

    { local _prev_trace=; [[ $- == *x* ]] && _prev_trace=1 && set +x; } 2>/dev/null

    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        local key="${line%%=*}"
        local value="${line#*=}"
        [[ -z "$key" ]] && continue
        case "$key" in
            SECRET_*)
                local secret_name="${key#SECRET_}"
                if [[ "$value" == "auto" ]]; then
                    if ! rhdh_secret_exists "$secret_name"; then
                        case "$secret_name" in
                            BACKEND_SECRET)
                                value=$(openssl rand -hex 32)
                                ;;
                            *)
                                value=$(openssl rand -hex 16)
                                ;;
                        esac
                        create_rhdh_secret "$secret_name" "$value"
                        log_info "Generated $secret_name"
                    else
                        log_info "Using existing $secret_name from Podman"
                    fi
                else
                    create_rhdh_secret "$secret_name" "$value"
                fi
                ;;
            DROPIN_*)
                local dropin_key="${key#DROPIN_}"
                config_dropins+=("${dropin_key}=${value}")
                ;;
        esac
    done < <(python3 "${LIB_DIR}/yaml-helper.py" apply-cloud-init \
        "$config_file" "$RHDH_APP_CONFIG" "$RHDH_APP_CONFIG_PRODUCTION")

    { [[ -n "${_prev_trace:-}" ]] && set -x; } 2>/dev/null

    chmod 644 "$RHDH_APP_CONFIG_PRODUCTION"

    # Auto-generate infra secrets not provided in cloud-init
    local infra_secret
    for infra_secret in BACKEND_SECRET POSTGRESQL_PASSWORD POSTGRESQL_ADMIN_PASSWORD; do
        if ! rhdh_secret_exists "$infra_secret"; then
            local generated
            case "$infra_secret" in
                BACKEND_SECRET) generated=$(openssl rand -hex 32) ;;
                *)              generated=$(openssl rand -hex 16) ;;
            esac
            create_rhdh_secret "$infra_secret" "$generated"
            log_info "Generated $infra_secret"
        fi
    done

    # Generate Quadlet drop-ins
    generate_secrets_dropin "rhdh"
    if [[ "$db_type" != "external" ]]; then
        generate_secrets_dropin "postgres"
        generate_postgres_config_dropin
    fi
    if [[ ${#config_dropins[@]} -gt 0 ]]; then
        generate_config_dropin "${config_dropins[@]}"
    fi

    # When using an external database, remove the postgres dependency
    # so rhdh.service starts without requiring the bundled PostgreSQL.
    if [[ "$db_type" == "external" ]]; then
        _generate_external_db_dropins
    fi

    systemctl daemon-reload 2>/dev/null || true

    shred -u /var/lib/cloud/instance/user-data.txt 2>/dev/null || true

    log_success "Configuration applied from $config_file"
}

# ============================================================================
# Check for cloud-init user-data
# ============================================================================
apply_config_from_cloud_init() {
    local cloud_init_data="/var/lib/cloud/instance/user-data.txt"

    if [[ -f "$cloud_init_data" ]]; then
        local ci_keys
        ci_keys=$(python3 "${LIB_DIR}/yaml-helper.py" list-cloud-init-keys 2>/dev/null \
                  | paste -sd'|' -) || true
        ci_keys="${ci_keys:-security|database|integrations|network}"

        if grep -qE "^(${ci_keys}):" "$cloud_init_data" 2>/dev/null; then
            apply_rhdh_config "$cloud_init_data"
            return $?
        fi
    fi

    return 1
}

# ============================================================================
# Main
# ============================================================================
main() {
    log_header "RHDH - First boot configuration"

    if [[ -f "$FIRST_BOOT_MARKER" ]]; then
        log_info "First-boot configuration already completed"
        exit 0
    fi

    # Step 1: Apply configuration from cloud-init
    log_header "Step 1: Checking for cloud-init configuration"

    local config_applied=false

    if apply_config_from_cloud_init; then
        config_applied=true
        log_success "Applied RHDH configuration from cloud-init"
    else
        log_info "No cloud-init configuration found"
    fi

    # Step 2: Auto-generate secrets if no cloud-init config was applied
    if ! $config_applied; then
        log_header "Step 2: Auto-generating infrastructure secrets"

        local infra_secret
        for infra_secret in BACKEND_SECRET POSTGRESQL_PASSWORD POSTGRESQL_ADMIN_PASSWORD; do
            if ! rhdh_secret_exists "$infra_secret"; then
                local generated
                case "$infra_secret" in
                    BACKEND_SECRET) generated=$(openssl rand -hex 32) ;;
                    *)              generated=$(openssl rand -hex 16) ;;
                esac
                create_rhdh_secret "$infra_secret" "$generated"
                log_info "Generated $infra_secret"
            else
                log_info "$infra_secret already exists"
            fi
        done

        generate_secrets_dropin "rhdh"
        generate_secrets_dropin "postgres"
        generate_postgres_config_dropin

        systemctl daemon-reload 2>/dev/null || true
    fi

    # Step 3: Mark first-boot complete
    mkdir -p "$(dirname "$FIRST_BOOT_MARKER")"

    local _timestamp _config_source
    _timestamp=$(date -Iseconds)
    _config_source=$($config_applied && echo "cloud-init" || echo "auto-generated")
    cat > "$FIRST_BOOT_MARKER" << EOF
first_boot_completed=${_timestamp}
admin_user=${ADMIN_USER}
config_source=${_config_source}
EOF
    chmod 644 "$FIRST_BOOT_MARKER"

    log_success "First-boot configuration complete"
    exit 0
}

main "$@"
