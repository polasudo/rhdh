#!/usr/bin/env python3
"""yaml-helper.py — YAML read/write utility for RHDH bootc configuration.

Subcommands:
    read   <file> <key.path>              Read a value by dot-path
    write  <file> <key.path> <value>      Write a value by dot-path (deep merge)
"""

import sys
import os
import yaml


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


def load_yaml(path):
    """Load YAML file, return empty dict if missing or empty."""
    if not os.path.exists(path):
        return {}
    with open(path) as f:
        return yaml.safe_load(f) or {}


def save_yaml(path, data):
    """Write YAML with explicit 644 permissions."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)
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


COMMANDS = {
    "read": cmd_read,
    "write": cmd_write,
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
