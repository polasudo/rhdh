#!/usr/bin/env python3
"""yaml-helper.py — YAML read/write utility for RHDH bootc configuration.

Subcommands:
    read             <file> <key.path>                  Read a value by dot-path
    write            <file> <key.path> <value>          Write a value by dot-path
    apply-cloud-init <cloud-init> <app-config> <prod>   Map cloud-init to production.yaml
    validate         <production.yaml>                  Check required keys exist

apply-cloud-init writes YAML config to production.yaml and outputs action
lines to stdout for the shell to process:
    SECRET_<KEY>=<value>   → create Podman secret
    DROPIN_<KEY>=<value>   → add to Quadlet config drop-in
"""

import sys
import os
import yaml


# ---------------------------------------------------------------------------
# Cloud-init to RHDH configuration field mapping
# ---------------------------------------------------------------------------
FIELD_MAP = [
    # Security
    ("security.backend_secret",           "BACKEND_SECRET",                    "secret"),

    # Database — builtin
    ("database.builtin.password",         "POSTGRESQL_PASSWORD",               "secret"),
    ("database.builtin.admin_password",   "POSTGRESQL_ADMIN_PASSWORD",         "secret"),
    ("database.builtin.user",             "backend.database.connection.user",  "yaml"),
    ("database.builtin.name",             "backend.database.connection.database", "yaml"),

    # Database — external
    ("database.type",                     "_db_type",                          "db_type"),
    ("database.external.host",            "backend.database.connection.host",  "yaml"),
    ("database.external.port",            "backend.database.connection.port",  "yaml"),
    ("database.external.user",            "backend.database.connection.user",  "yaml"),
    ("database.external.name",            "backend.database.connection.database", "yaml"),
    ("database.external.password",        "POSTGRESQL_PASSWORD",               "secret"),
    ("database.external.ssl",             "backend.database.connection.ssl",   "yaml"),

    # Network
    ("network.base_url",                  "app.baseUrl",                       "yaml"),

    # Integrations
    ("integrations.github.token",         "GITHUB_TOKEN",                      "secret"),
    ("integrations.github.client_id",     "GITHUB_CLIENT_ID",                  "secret"),
    ("integrations.github.client_secret", "GITHUB_CLIENT_SECRET",              "secret"),
    ("integrations.gitlab.token",         "GITLAB_TOKEN",                      "secret"),
]

REQUIRED_KEYS = []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_nested(data, dot_path):
    """Read a value from a nested dict using dot notation."""
    if not isinstance(data, dict):
        return None
    keys = dot_path.split(".")
    val = data
    for k in keys:
        if not isinstance(val, dict):
            return None
        val = val.get(k)
        if val is None:
            return None
    return val


def set_nested(data, dot_path, value):
    """Set a value in a nested dict using dot notation, creating parents."""
    keys = dot_path.split(".")
    d = data
    for k in keys[:-1]:
        d = d.setdefault(k, {})
    d[keys[-1]] = value


def deep_merge(base, override):
    """Recursively merge override into base. Override wins on conflicts."""
    for k, v in override.items():
        if k in base and isinstance(base[k], dict) and isinstance(v, dict):
            deep_merge(base[k], v)
        else:
            base[k] = v
    return base


def load_yaml(path):
    """Load YAML file, return empty dict if missing or empty."""
    if not os.path.exists(path):
        return {}
    try:
        with open(path) as f:
            return yaml.safe_load(f) or {}
    except yaml.YAMLError as e:
        print(f"ERROR: Failed to parse {path}: {e}", file=sys.stderr)
        sys.exit(1)


REFERENCE_MARKER = "# " + "=" * 73


def extract_reference_block(path):
    """Extract the reference documentation block from a YAML file."""
    if not os.path.exists(path):
        return ""
    with open(path) as f:
        content = f.read()

    marker_pos = content.find(REFERENCE_MARKER)
    if marker_pos != -1:
        return content[marker_pos:]

    comments = []
    for line in content.splitlines(keepends=True):
        stripped = line.strip()
        if stripped == "" or stripped.startswith("#"):
            comments.append(line)
    return "".join(comments) if comments else ""


def save_yaml(path, data):
    """Write YAML preserving key order and reference docs, with 644 perms."""
    os.makedirs(os.path.dirname(path), exist_ok=True)

    ref_block = extract_reference_block(path)

    with open(path, "w") as f:
        if ref_block:
            f.write("# Active configuration\n")
            f.write("# Edit values below, then: sudo systemctl restart rhdh\n\n")
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)
        if ref_block:
            f.write("\n")
            if not ref_block.startswith(REFERENCE_MARKER):
                f.write(REFERENCE_MARKER + "\n")
                f.write("# Configuration Reference\n")
                f.write("# Uncomment and modify sections below as needed.\n")
                f.write("# After editing: sudo systemctl restart rhdh\n")
                f.write(REFERENCE_MARKER + "\n\n")
            f.write(ref_block)
    os.chmod(path, 0o644)


def coerce_value(value):
    """Convert string values to appropriate Python types for YAML output."""
    if isinstance(value, str):
        low = value.lower()
        if low == "true":
            return True
        if low == "false":
            return False
        try:
            return int(value)
        except ValueError:
            pass
    return value


def normalize_url(url):
    """Remove trailing slashes from URLs."""
    if isinstance(url, str):
        while url.endswith("/"):
            url = url[:-1]
    return url


# ---------------------------------------------------------------------------
# Subcommands
# ---------------------------------------------------------------------------

def cmd_read(args):
    """Read a value from a YAML file by dot-path."""
    if len(args) < 2:
        print("Usage: yaml-helper.py read <file> <key.path>", file=sys.stderr)
        return 1
    data = load_yaml(args[0])
    val = get_nested(data, args[1])
    if val is not None and not isinstance(val, dict):
        s = str(val)
        if s.startswith("${"):
            return 1
        print(s)
        return 0
    return 1


def cmd_write(args):
    """Write a value to a YAML file by dot-path (deep merge, preserves existing)."""
    if len(args) < 3:
        print("Usage: yaml-helper.py write <file> <key.path> <value>", file=sys.stderr)
        return 1
    path, key_path, raw_value = args[0], args[1], args[2]
    data = load_yaml(path)
    set_nested(data, key_path, coerce_value(raw_value))
    save_yaml(path, data)
    return 0


def cmd_apply_cloud_init(args):
    """Map cloud-init values to production.yaml (non-secrets only)."""
    if len(args) < 3:
        print("Usage: yaml-helper.py apply-cloud-init <cloud-init> <app-config> <production>",
              file=sys.stderr)
        return 1
    ci_path, _app_config_path, prod_path = args[0], args[1], args[2]
    ci = load_yaml(ci_path)
    if not ci:
        return 0

    prod = load_yaml(prod_path)
    new_config = {}
    db_type = str(get_nested(ci, "database.type") or "builtin")

    for ci_dot, target, category in FIELD_MAP:
        val = get_nested(ci, ci_dot)
        if val is None:
            continue

        if ci_dot.startswith("database.external.") and db_type != "external":
            continue
        if ci_dot.startswith("database.builtin.") and db_type == "external":
            continue

        if category == "secret":
            if str(val).strip():
                print(f"SECRET_{target}={val}")
            continue

        if category == "yaml":
            coerced = coerce_value(val)
            if "url" in ci_dot.lower() or "Url" in target:
                coerced = normalize_url(str(coerced))

            set_nested(new_config, target, coerced)

            if ci_dot == "network.base_url":
                set_nested(new_config, "backend.baseUrl", coerced)
                set_nested(new_config, "backend.cors.origin", coerced)

        elif category == "db_type":
            if str(val) != "external":
                set_nested(new_config, "backend.database.connection.host", "rhdh-postgres")
                set_nested(new_config, "backend.database.connection.port", 5432)
                set_nested(new_config, "backend.database.connection.database", "rhdh_backstage")
                set_nested(new_config, "backend.database.connection.user", "postgres")

        elif category == "dropin":
            val_str = normalize_url(str(val)) if "url" in ci_dot.lower() else str(val)
            print(f"DROPIN_{target}={val_str}")

    set_nested(new_config, "backend.database.client", "pg")

    merged = deep_merge(prod, new_config)
    save_yaml(prod_path, merged)
    return 0


def cmd_validate(args):
    """Check that required keys exist in production.yaml."""
    if len(args) < 1:
        print("Usage: yaml-helper.py validate <production.yaml>", file=sys.stderr)
        return 1
    data = load_yaml(args[0])
    missing = []
    for key in REQUIRED_KEYS:
        val = get_nested(data, key)
        if val is None or (isinstance(val, str) and val.startswith("${")):
            missing.append(key)
    if missing:
        for k in missing:
            print(k)
        return 1
    return 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

COMMANDS = {
    "read": cmd_read,
    "write": cmd_write,
    "apply-cloud-init": cmd_apply_cloud_init,
    "validate": cmd_validate,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__.strip())
        print(f"\nCommands: {', '.join(COMMANDS)}")
        return 0

    cmd = sys.argv[1]
    if cmd not in COMMANDS:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        print(f"Available: {', '.join(COMMANDS)}", file=sys.stderr)
        return 1

    return COMMANDS[cmd](sys.argv[2:])


if __name__ == "__main__":
    sys.exit(main() or 0)
