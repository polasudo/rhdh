#!/bin/bash

# Detect VM IP and update BASE_URL in rhdh.env
# This script runs before RHDH container starts via systemd ExecStartPre
#
# Features:
# - AWS-aware: Automatically detects and uses AWS public IP when available
# - QEMU NAT-aware: Uses localhost for 10.0.2.x (requires port forwarding)
# - Port extraction: Extracts port from BASE_URL and updates container port mapping
# - Dynamic IP support: Re-detects IP on every boot for cloud deployments
#
# Configuration:
# - Set EXTERNAL_URL in rhdh.env for proxy/OpenShift/static scenarios
# - Auto-detected URL is written to rhdh.env as BASE_URL

set -euo pipefail

source "${LIB_DIR:-/usr/local/lib/rhdh}/common.sh"

ENV_FILE="${RHDH_ENV_FILE}"
QUADLET_FILE="/etc/containers/systemd/rhdh.container"
QUADLET_FILE_ALT="/usr/share/containers/systemd/rhdh.container"
AUTO_DETECT_MARKER="${RHDH_CONFIG_DIR}/.base_url_auto_detected"
DEFAULT_PORT="7007"

echo "[INFO] Detecting BASE_URL configuration..."

# --- AWS EC2 Detection ---

is_aws_ec2() {
    curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/ >/dev/null 2>&1
}

get_aws_public_ip() {
    local token
    token=$(curl -s --connect-timeout 2 -X PUT "http://169.254.169.254/latest/api/token" \
        -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>/dev/null || true)

    if [ -z "$token" ]; then
        echo ""
        return
    fi

    local public_ip
    public_ip=$(curl -s --connect-timeout 5 -H "X-aws-ec2-metadata-token: $token" \
        http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)

    if [ -n "$public_ip" ] && [[ "$public_ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "$public_ip"
    else
        echo ""
    fi
}

get_aws_private_ip() {
    local token
    token=$(curl -s --connect-timeout 2 -X PUT "http://169.254.169.254/latest/api/token" \
        -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>/dev/null || true)

    if [ -z "$token" ]; then
        echo ""
        return
    fi

    local private_ip
    private_ip=$(curl -s --connect-timeout 5 -H "X-aws-ec2-metadata-token: $token" \
        http://169.254.169.254/latest/meta-data/local-ipv4 2>/dev/null || true)

    if [ -n "$private_ip" ] && [[ "$private_ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "$private_ip"
    else
        echo ""
    fi
}

# --- QEMU NAT Detection ---

is_qemu_user_nat() {
    local ip="$1"
    [[ "$ip" =~ ^10\.0\.2\. ]]
}

# --- Port Utilities ---

extract_port_from_url() {
    local url="$1"
    local url_without_protocol="${url#*://}"

    if [[ "$url_without_protocol" =~ ^[^/:]+:([0-9]+) ]]; then
        local port="${BASH_REMATCH[1]}"
        if [[ "$port" =~ ^[0-9]+$ ]] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ]; then
            echo "$port"
            return
        fi
    fi

    echo "$DEFAULT_PORT"
}

update_container_port() {
    local new_port="$1"
    local quadlet_file=""

    if [ -f "$QUADLET_FILE" ]; then
        quadlet_file="$QUADLET_FILE"
    elif [ -f "$QUADLET_FILE_ALT" ]; then
        quadlet_file="$QUADLET_FILE_ALT"
    else
        return 0
    fi

    local current_port=""
    if grep -q "^PublishPort=" "$quadlet_file"; then
        current_port=$(grep "^PublishPort=" "$quadlet_file" | cut -d'=' -f2 | cut -d':' -f1 || echo "$DEFAULT_PORT")
    fi

    if [ "$new_port" != "$current_port" ]; then
        echo "[INFO] Updating container port mapping: ${current_port:-$DEFAULT_PORT} -> $new_port"
        if grep -q "^PublishPort=" "$quadlet_file"; then
            sed -i "s|^PublishPort=[0-9]*:7007|PublishPort=${new_port}:7007|" "$quadlet_file"
        fi
        systemctl daemon-reload 2>/dev/null || true
    fi
}

# --- VM IP Detection ---

detect_vm_ip() {
    local vm_ip=""

    if command -v ip >/dev/null 2>&1; then
        vm_ip=$(ip route get 1.1.1.1 2>/dev/null | grep -o 'src [0-9.]*' | cut -d' ' -f2 | head -1 || true)
    fi

    if [ -z "$vm_ip" ] && command -v hostname >/dev/null 2>&1; then
        vm_ip=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
    fi

    if [ -z "$vm_ip" ] && [ -f "/proc/net/route" ]; then
        local iface
        iface=$(awk '/^[^[:space:]]+[[:space:]]+00000000[[:space:]]/ { print $1; exit }' /proc/net/route 2>/dev/null)
        if [ -n "$iface" ] && command -v ip >/dev/null 2>&1; then
            vm_ip=$(ip addr show "$iface" 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d'/' -f1 | head -1 || true)
        fi
    fi

    if [ -n "$vm_ip" ] && [ "$vm_ip" != "127.0.0.1" ] && [[ "$vm_ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "$vm_ip"
    else
        echo ""
    fi
}

# --- Auto-detect Logic ---

should_auto_detect() {
    local current_base_url="$1"

    if [ -f "$AUTO_DETECT_MARKER" ]; then
        return 0
    fi

    if [ -z "$current_base_url" ] ||
       [ "$current_base_url" = "http://localhost:7007" ] ||
       [ "$current_base_url" = "http://localhost" ] ||
       [ "$current_base_url" = "http://127.0.0.1:7007" ] ||
       [[ "$current_base_url" =~ \$\{.*\} ]] ||
       [[ "$current_base_url" =~ PLACEHOLDER ]]; then
        return 0
    fi

    # Custom localhost port indicates intentional port forwarding — preserve it
    if [[ "$current_base_url" =~ ^https?://localhost:([0-9]+) ]]; then
        local port="${BASH_REMATCH[1]}"
        if [ "$port" = "7007" ] || [ "$port" = "80" ]; then
            return 0
        fi
        return 1
    fi

    if [[ "$current_base_url" =~ ^https?://127\.0\.0\.1:([0-9]+) ]]; then
        local port="${BASH_REMATCH[1]}"
        if [ "$port" = "7007" ] || [ "$port" = "80" ]; then
            return 0
        fi
        return 1
    fi

    return 1
}

mark_as_auto_detected() {
    echo "# Auto-detected at: $(date -Iseconds)" > "$AUTO_DETECT_MARKER"
    chmod 600 "$AUTO_DETECT_MARKER"
}

clear_auto_detect_marker() {
    rm -f "$AUTO_DETECT_MARKER"
}

# --- Main ---

main() {
    # Check for explicit EXTERNAL_URL (proxy/OpenShift/static IP scenarios)
    local external_url=""
    if [ -f "$ENV_FILE" ]; then
        external_url=$(grep "^EXTERNAL_URL=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 || true)
    fi

    if [ -n "$external_url" ]; then
        echo "[INFO] Using configured EXTERNAL_URL: $external_url"
        sed -i "s|^BASE_URL=.*|BASE_URL=${external_url}|" "$ENV_FILE"
        local port
        port=$(extract_port_from_url "$external_url")
        update_container_port "$port"
        clear_auto_detect_marker
        echo "[OK] Set BASE_URL=${external_url} from EXTERNAL_URL"
        return 0
    fi

    # Read current BASE_URL from env file
    local current_base_url=""
    if [ -f "$ENV_FILE" ]; then
        current_base_url=$(grep "^BASE_URL=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 || true)
    fi

    if ! should_auto_detect "$current_base_url"; then
        echo "[INFO] Preserving manual BASE_URL: $current_base_url"
        local port
        port=$(extract_port_from_url "$current_base_url")
        update_container_port "$port"
        return 0
    fi

    # Detect IP
    local detected_ip=""

    if is_aws_ec2; then
        echo "[INFO] AWS EC2 instance detected"
        detected_ip=$(get_aws_public_ip)
        if [ -n "$detected_ip" ]; then
            echo "[INFO] Detected AWS public IP: $detected_ip"
        else
            detected_ip=$(get_aws_private_ip)
            if [ -n "$detected_ip" ]; then
                echo "[INFO] Detected AWS private IP: $detected_ip (VPC-only access)"
            fi
        fi
    fi

    if [ -z "$detected_ip" ]; then
        detected_ip=$(detect_vm_ip)
        if [ -n "$detected_ip" ]; then
            echo "[INFO] Detected VM IP: $detected_ip"
        fi
    fi

    # Extract port from current config to preserve custom port settings
    local rhdh_port="$DEFAULT_PORT"
    if [ -n "$current_base_url" ]; then
        rhdh_port=$(extract_port_from_url "$current_base_url")
    fi

    update_container_port "$rhdh_port"

    if [ -n "$detected_ip" ]; then
        local new_base_url=""

        if is_qemu_user_nat "$detected_ip"; then
            echo "[INFO] QEMU user-mode NAT detected (IP: $detected_ip)"
            new_base_url="http://localhost:${rhdh_port}"
            clear_auto_detect_marker
        else
            new_base_url="http://${detected_ip}:${rhdh_port}"
            mark_as_auto_detected
        fi

        sed -i "s|^BASE_URL=.*|BASE_URL=${new_base_url}|" "$ENV_FILE"
        echo "[OK] Updated BASE_URL=${new_base_url}"
        echo "[INFO] RHDH will be accessible at: $new_base_url"
    else
        echo "[WARNING] Could not detect IP, keeping default BASE_URL"
        if [ -f "$ENV_FILE" ] && ! grep -q "^BASE_URL=" "$ENV_FILE"; then
            echo "BASE_URL=http://localhost:${rhdh_port}" >> "$ENV_FILE"
        fi
        clear_auto_detect_marker
    fi
}

main "$@"
