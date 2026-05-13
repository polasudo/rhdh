#!/bin/bash

set -euo pipefail

# Entrypoint for the main RHDH container.
# Waits for the dynamic plugin config to be generated,
# then starts the Backstage backend with appropriate config files.
#
# If user-supplied override files for catalog entities (users/components) exist,
# this script replaces their paths in the base config accordingly.

# Fail fast if critical secrets are not configured
_val="${BACKEND_SECRET:-}"
if [[ -z "$_val" || "$_val" == CHANGE_ME_* ]]; then
    echo "[FATAL] BACKEND_SECRET is not configured."
    echo "        Run first-boot-config.sh or provision via cloud-init."
    exit 1
fi
unset _val

DYNAMIC_PLUGINS_CONFIG="/opt/app-root/src/dynamic-plugins-root/app-config.dynamic-plugins.yaml"
DEFAULT_APP_CONFIG="configs/app-config/app-config.yaml"
PATCHED_APP_CONFIG="generated/app-config.patched.yaml"

PRODUCTION_APP_CONFIG="configs/app-config/app-config.production.yaml"
USER_APP_CONFIG="configs/app-config/app-config.local.yaml"
LIGHTSPEED_APP_CONFIG="developer-lightspeed/configs/app-config/app-config.lightspeed.local.yaml"
LEGACY_USER_APP_CONFIG="configs/app-config.local.yaml"

USERS_OVERRIDE="configs/catalog-entities/users.override.yaml"
COMPONENTS_OVERRIDE="configs/catalog-entities/components.override.yaml"

mkdir -p generated
cp -f "$DEFAULT_APP_CONFIG" "$PATCHED_APP_CONFIG"

# Add GitHub/GitLab integrations ONLY when valid tokens are provided.
# This makes RHDH work out of the box without requiring placeholder tokens.
add_integrations_to_config() {
    local integrations_yaml=""

    if [ -n "${GITHUB_TOKEN:-}" ] && \
       [ "$GITHUB_TOKEN" != "placeholder-not-used" ] && \
       [ "$GITHUB_TOKEN" != "PLACEHOLDER_REPLACE_WITH_YOUR_TOKEN" ] && \
       [[ ! "$GITHUB_TOKEN" =~ ^PLACEHOLDER ]] && \
       [[ ! "$GITHUB_TOKEN" =~ ^demo- ]]; then
        echo "[INFO] GitHub integration enabled (valid token detected)"
        integrations_yaml="${integrations_yaml}
integrations:
  github:
    - host: ${GITHUB_URL:-github.com}
      token: ${GITHUB_TOKEN}"
    else
        echo "[INFO] GitHub integration disabled (no valid token provided)"
    fi

    if [ -n "${GITLAB_TOKEN:-}" ] && \
       [ "$GITLAB_TOKEN" != "placeholder-not-used" ] && \
       [ "$GITLAB_TOKEN" != "PLACEHOLDER_REPLACE_WITH_YOUR_TOKEN" ] && \
       [[ ! "$GITLAB_TOKEN" =~ ^PLACEHOLDER ]] && \
       [[ ! "$GITLAB_TOKEN" =~ ^demo- ]]; then
        echo "[INFO] GitLab integration enabled (valid token detected)"
        if [ -n "$integrations_yaml" ]; then
            integrations_yaml="${integrations_yaml}
  gitlab:
    - host: ${GITLAB_URL:-gitlab.com}
      token: ${GITLAB_TOKEN}"
        else
            integrations_yaml="
integrations:
  gitlab:
    - host: ${GITLAB_URL:-gitlab.com}
      token: ${GITLAB_TOKEN}"
        fi
    else
        echo "[INFO] GitLab integration disabled (no valid token provided)"
    fi

    if [ -n "$integrations_yaml" ]; then
        echo "$integrations_yaml" >> "$PATCHED_APP_CONFIG"
    fi
}

add_integrations_to_config

echo "[INFO] Running dynamic plugins preparation..."

export DYNAMIC_PLUGINS_ROOT="${DYNAMIC_PLUGINS_ROOT:-/opt/app-root/src/dynamic-plugins-root}"
export NPM_CONFIG_CACHE="/opt/app-root/src/.npm"

/usr/local/bin/prepare-and-install-dynamic-plugins.sh

if [ -f "$DYNAMIC_PLUGINS_CONFIG" ]; then
    echo "[OK] Dynamic plugins config created successfully: $DYNAMIC_PLUGINS_CONFIG"
else
    echo "[WARNING] $DYNAMIC_PLUGINS_CONFIG not found, continuing with minimal config"
fi

# Apply overrides by replacing target paths in the patched config
if [ -f "$USERS_OVERRIDE" ]; then
  echo "Applying users override"
  sed -i "s|/opt/app-root/src/configs/catalog-entities/users.yaml|/opt/app-root/src/$USERS_OVERRIDE|" "$PATCHED_APP_CONFIG"
fi

if [ -f "$COMPONENTS_OVERRIDE" ]; then
  echo "Applying components override"
  sed -i "s|/opt/app-root/src/configs/catalog-entities/components.yaml|/opt/app-root/src/$COMPONENTS_OVERRIDE|" "$PATCHED_APP_CONFIG"
fi

# Build extra config layers (production → local, highest wins)
EXTRA_CONFIGS=""
if [ -f "$PRODUCTION_APP_CONFIG" ]; then
  echo "[INFO] Using production config: $PRODUCTION_APP_CONFIG"
  EXTRA_CONFIGS="$PRODUCTION_APP_CONFIG"
fi

if [ -f "$USER_APP_CONFIG" ]; then
  echo "[INFO] Using user config: $USER_APP_CONFIG"
  EXTRA_CONFIGS="$EXTRA_CONFIGS $USER_APP_CONFIG"
elif [ -f "$LEGACY_USER_APP_CONFIG" ]; then
  echo "[WARNING] Using legacy app-config.local.yaml. Please migrate to $USER_APP_CONFIG."
  EXTRA_CONFIGS="$EXTRA_CONFIGS $LEGACY_USER_APP_CONFIG"
fi

if [ -f "$LIGHTSPEED_APP_CONFIG" ]; then
  echo "[INFO] Using lightspeed config: $LIGHTSPEED_APP_CONFIG"
  EXTRA_CONFIGS="$EXTRA_CONFIGS $LIGHTSPEED_APP_CONFIG"
fi

EXTRA_CLI_ARGS=""
for config in $EXTRA_CONFIGS; do
  EXTRA_CLI_ARGS="$EXTRA_CLI_ARGS --config $config"
done

echo "[INFO] Using BASE_URL from environment: ${BASE_URL:-http://localhost:7007}"

export ENABLE_AUTH_PROVIDER_MODULE_OVERRIDE="${ENABLE_AUTH_PROVIDER_MODULE_OVERRIDE:-true}"

# shellcheck disable=SC2086
exec node packages/backend --no-node-snapshot \
  --config "configs/app-config/app-config.yaml" \
  --config "$DYNAMIC_PLUGINS_CONFIG" \
  --config "$PATCHED_APP_CONFIG" $EXTRA_CLI_ARGS
