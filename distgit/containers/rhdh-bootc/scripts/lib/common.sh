#!/bin/bash
# Common variables and functions for RHDH bootc scripts

# ============================================================================
# Configuration Paths (overridable via env vars for downstream consumers)
# ============================================================================
RHDH_CONFIG_DIR="${RHDH_CONFIG_DIR:-/etc/rhdh}"
RHDH_APP_CONFIG="${RHDH_APP_CONFIG:-${RHDH_CONFIG_DIR}/configs/app-config/app-config.yaml}"
RHDH_APP_CONFIG_PRODUCTION="${RHDH_APP_CONFIG_PRODUCTION:-${RHDH_CONFIG_DIR}/configs/app-config/app-config.production.yaml}"
RHDH_SETUP_COMPLETE="${RHDH_SETUP_COMPLETE:-${RHDH_CONFIG_DIR}/.setup-complete}"
RHDH_ENV_FILE="${RHDH_ENV_FILE:-${RHDH_CONFIG_DIR}/rhdh.env}"
POSTGRES_ENV_FILE="${POSTGRES_ENV_FILE:-${RHDH_CONFIG_DIR}/postgres.env}"

LIB_DIR="${LIB_DIR:-/usr/local/lib/rhdh}"

# Service and container names (overridable for downstream branding)
RHDH_CONTAINER_NAME="${RHDH_CONTAINER_NAME:-rhdh}"
RHDH_POSTGRES_CONTAINER="${RHDH_POSTGRES_CONTAINER:-rhdh-postgres}"
RHDH_SERVICE="${RHDH_SERVICE:-rhdh.service}"
RHDH_POSTGRES_SERVICE="${RHDH_POSTGRES_SERVICE:-postgres.service}"

# Secret prefix for Podman secrets (e.g., rhdh_backend_secret)
RHDH_SECRET_PREFIX="${RHDH_SECRET_PREFIX:-rhdh}"

# ============================================================================
# Colors (only if terminal supports colors)
# ============================================================================
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    BOLD=''
    NC=''
fi

# ============================================================================
# Logging Functions
# ============================================================================
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# ============================================================================
# Utility Functions
# ============================================================================

require_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This command must be run as root (use sudo)"
        exit 1
    fi
}

mask_secret() {
    local secret="$1"
    local len=${#secret}
    if [[ $len -le 8 ]]; then
        echo "********"
    else
        echo "${secret:0:4}****${secret: -4}"
    fi
}

disable_password_auth() {
    local sshd_dropin="/etc/ssh/sshd_config.d/10-disable-password-auth.conf"
    if [[ -f "$sshd_dropin" ]]; then
        log_info "Password auth already disabled via $sshd_dropin"
    else
        mkdir -p /etc/ssh/sshd_config.d
        printf '%s\n' \
            'PasswordAuthentication no' \
            'ChallengeResponseAuthentication no' \
            'PermitRootLogin prohibit-password' \
            'UsePAM yes' \
            'PubkeyAuthentication yes' \
            > "$sshd_dropin"
        chmod 644 "$sshd_dropin"
        log_info "Password auth disabled"
    fi
}

# ============================================================================
# Podman Secrets Configuration
# ============================================================================

SECRET_VARS=(
    "BACKEND_SECRET"
    "POSTGRESQL_PASSWORD"
    "POSTGRESQL_ADMIN_PASSWORD"
    "GITHUB_TOKEN"
    "GITHUB_CLIENT_ID"
    "GITHUB_CLIENT_SECRET"
    "GITLAB_TOKEN"
)

_load_dropin_secret_vars() {
    local helper="${LIB_DIR:-/usr/local/lib/rhdh}/yaml-helper.py"
    [[ -f "$helper" ]] || return 0
    local target
    while IFS= read -r target; do
        [[ -n "$target" ]] || continue
        local existing
        for existing in "${SECRET_VARS[@]}"; do
            [[ "$existing" == "$target" ]] && continue 2
        done
        SECRET_VARS+=("$target")
    done < <(python3 "$helper" list-secret-vars 2>/dev/null)
}
_load_dropin_secret_vars

SYSTEM_SECRET_VARS=(
    "BACKEND_SECRET"
    "POSTGRESQL_PASSWORD"
    "POSTGRESQL_ADMIN_PASSWORD"
)

is_secret_var() {
    local key="$1"
    local var
    for var in "${SECRET_VARS[@]}"; do
        [[ "$var" == "$key" ]] && return 0
    done
    return 1
}

is_system_secret() {
    local key="$1"
    local var
    for var in "${SYSTEM_SECRET_VARS[@]}"; do
        [[ "$var" == "$key" ]] && return 0
    done
    return 1
}

get_secret_name() {
    local key="$1"
    echo "${RHDH_SECRET_PREFIX}_${key,,}"
}

create_rhdh_secret() {
    local key="$1"
    local value="${2:- }"
    local secret_name
    secret_name=$(get_secret_name "$key")

    if ! printf '%s' "$value" | podman secret create --replace "$secret_name" - >/dev/null 2>&1; then
        podman secret rm "$secret_name" 2>/dev/null || true
        printf '%s' "$value" | podman secret create "$secret_name" - >/dev/null 2>&1 || {
            log_error "Failed to create Podman secret: $secret_name"
            return 1
        }
    fi
}

get_rhdh_secret() {
    local key="$1"
    local secret_name
    secret_name=$(get_secret_name "$key")

    local val
    val=$(podman secret inspect "$secret_name" --showsecret --format '{{.SecretData}}' 2>/dev/null) || return 1
    if [[ "$val" == " " ]]; then
        echo ""
    else
        echo "$val"
    fi
}

rhdh_secret_exists() {
    local key="$1"
    local secret_name
    secret_name=$(get_secret_name "$key")
    podman secret inspect "$secret_name" >/dev/null 2>&1
}
