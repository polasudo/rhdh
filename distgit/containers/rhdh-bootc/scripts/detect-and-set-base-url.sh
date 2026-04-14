#!/bin/bash

# Detect VM IP and update BASE_URL in rhdh.env
# This script runs before RHDH container starts via systemd ExecStartPre
#
# USAGE:
#   - Bare metal/VM: Auto-detects IP from network routes
#   - Behind proxy/OpenShift: Set EXTERNAL_URL env var in rhdh.env
#     Example: EXTERNAL_URL=https://rhdh-myproject.apps.cluster.example.com

set -euo pipefail

ENV_FILE="/etc/rhdh/rhdh.env"
BACKUP_FILE="/etc/rhdh/rhdh.env.backup"

echo "[INFO] Detecting BASE_URL configuration..."

# Detect the primary IP address of this VM
detect_vm_ip() {
    local vm_ip=""
    
    # Method 1: Get IP from default route (most reliable)
    if command -v ip >/dev/null 2>&1; then
        vm_ip=$(ip route get 1.1.1.1 2>/dev/null | grep -o 'src [0-9.]*' | cut -d' ' -f2 | head -1 || true)
    fi
    
    # Method 2: Use hostname -I as fallback
    if [ -z "$vm_ip" ] && command -v hostname >/dev/null 2>&1; then
        vm_ip=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
    fi
    
    # Method 3: Parse /proc/net/route as last resort
    if [ -z "$vm_ip" ] && [ -f "/proc/net/route" ]; then
        # Get first non-loopback interface IP
        local iface=$(awk '/^[^[:space:]]+[[:space:]]+00000000[[:space:]]/ { print $1; exit }' /proc/net/route 2>/dev/null)
        if [ -n "$iface" ] && command -v ip >/dev/null 2>&1; then
            vm_ip=$(ip addr show "$iface" 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d'/' -f1 | head -1 || true)
        fi
    fi
    
    # Validate detected IP
    if [ -n "$vm_ip" ] && [ "$vm_ip" != "127.0.0.1" ] && [[ "$vm_ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "$vm_ip"
    else
        echo ""
    fi
}

# Main execution
main() {
    # Backup original env file if not already done
    if [ -f "$ENV_FILE" ] && [ ! -f "$BACKUP_FILE" ]; then
        cp "$ENV_FILE" "$BACKUP_FILE"
        echo "[INFO] Backed up original rhdh.env to rhdh.env.backup"
    fi

    # Check if EXTERNAL_URL is already set in the env file (for proxy/OpenShift scenarios)
    local external_url=""
    if [ -f "$ENV_FILE" ]; then
        external_url=$(grep "^EXTERNAL_URL=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 || true)
    fi

    if [ -n "$external_url" ]; then
        # Use the explicitly configured EXTERNAL_URL (for OpenShift/proxy scenarios)
        echo "[INFO] Using configured EXTERNAL_URL: $external_url"
        sed -i "s|^BASE_URL=.*|BASE_URL=${external_url}|" "$ENV_FILE"
        echo "[OK] Set BASE_URL=${external_url} from EXTERNAL_URL"
    else
        # Auto-detect VM IP (for bare metal/VM scenarios)
        local detected_ip
        detected_ip=$(detect_vm_ip)

        if [ -n "$detected_ip" ]; then
            echo "[INFO] Detected VM IP: $detected_ip"

            # Update BASE_URL in environment file
            if [ -f "$ENV_FILE" ]; then
                # Use sed to replace BASE_URL line
                sed -i "s|^BASE_URL=.*|BASE_URL=http://${detected_ip}:7007|" "$ENV_FILE"
                echo "[OK] Updated BASE_URL=http://${detected_ip}:7007 in $ENV_FILE"
            else
                echo "[WARNING] $ENV_FILE not found, creating with detected IP"
                echo "BASE_URL=http://${detected_ip}:7007" > "$ENV_FILE"
            fi

            # Verify the update
            local current_base_url
            current_base_url=$(grep "^BASE_URL=" "$ENV_FILE" | cut -d'=' -f2 || true)
            echo "[INFO] Current BASE_URL: $current_base_url"

        else
            echo "[WARNING] Could not detect VM IP, keeping default BASE_URL"
            # Ensure localhost fallback exists
            if [ -f "$ENV_FILE" ] && ! grep -q "^BASE_URL=" "$ENV_FILE"; then
                echo "BASE_URL=http://localhost:7007" >> "$ENV_FILE"
                echo "[INFO] Added fallback BASE_URL=http://localhost:7007"
            fi
        fi
    fi
}

# Execute main function
main "$@"
