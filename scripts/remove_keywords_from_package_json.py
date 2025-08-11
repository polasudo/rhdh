"""
Safe removal of support:/lifecycle: keywords from dynamic plugins' package.json files.

Behavior:
- Runs a pre-flight consistency check against marketplace YAML files.
- If any package has mismatched lifecycle/support or a missing YAML, aborts with a report.
- Otherwise, removes only support:/lifecycle: keywords.

Usage:
  python scripts/remove_keywords_from_package_json.py --yes        # actually modify files
  python scripts/remove_keywords_from_package_json.py              # dry run (no changes)

Assisted-by: Cursor
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import List


def find_wrapper_package_json_files(repo_root: Path) -> List[Path]:
    wrappers_dir = repo_root / "dynamic-plugins" / "wrappers"
    package_files: List[Path] = []
    for item in wrappers_dir.iterdir():
        if item.is_dir():
            package_json = item / "package.json"
            if package_json.exists():
                package_files.append(package_json)
    return package_files


def load_json(path: Path) -> dict:
    with open(path, "r") as f:
        return json.load(f)


def save_json(path: Path, data: dict) -> None:
    with open(path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def run_preflight_check(repo_root: Path) -> int:
    """Use the existing checker to ensure there are no mismatches or missing YAML files.

    Returns the number of problems found (mismatch + missing YAML).
    """
    # Ensure we can import the checker from scripts/
    scripts_dir = repo_root / "scripts"
    sys.path.insert(0, str(scripts_dir))
    try:
        from check_package_yaml_consistency import PackageYamlChecker  # type: ignore
    except Exception as imp_err:  # pragma: no cover
        print(f"Error: unable to import PackageYamlChecker: {imp_err}")
        return 1

    checker = PackageYamlChecker(str(repo_root))
    checker.check_consistency()

    problems = [r for r in checker.results if r["status"] in ("MISMATCH", "NO_YAML")]
    if problems:
        print("\n========== ABORTING: Pre-flight check failed ==========")
        mismatch_count = len([p for p in problems if p["status"] == "MISMATCH"])
        no_yaml_count = len([p for p in problems if p["status"] == "NO_YAML"])
        print(f"❌ Inconsistent packages: {mismatch_count}")
        print(f"⚠️ Missing marketplace catalog entity files: {no_yaml_count}")
        print("Fix the above issues before removing keywords.")
        print("\nTo fix these issues:")
        print("1. Run the consistency checker to see details: python scripts/check_package_yaml_consistency.py")
        print("2. Create missing YAML files or fix mismatches")
        print("3. Re-run this script")
        
    else:
        print("✅ Pre-flight check passed: no inconsistencies or missing marketplace catalog entity files found.")

    return len(problems)


def remove_support_lifecycle_keywords(repo_root: Path, dry_run: bool) -> int:
    """Remove support:/lifecycle: keywords across wrappers. Returns count of modified files."""
    modified = 0
    for package_json_path in find_wrapper_package_json_files(repo_root):
        try:
            data = load_json(package_json_path)
        except Exception as e:
            print(f"Skipping {package_json_path}: failed to parse JSON ({e})")
            continue

        keywords = list(data.get("keywords", []))
        if not keywords:
            continue

        kept = []
        removed = []
        for kw in keywords:
            if isinstance(kw, str) and (kw.startswith("support:") or kw.startswith("lifecycle:")):
                removed.append(kw)
            else:
                kept.append(kw)

        if not removed:
            continue

        print(f"\n{package_json_path}")
        print(f"  Removed: {removed}")
        if kept:
            print(f"  Kept:    {kept}")
        else:
            print("  Kept:    [] (keywords will be removed entirely)")

        if not dry_run:
            if kept:
                data["keywords"] = kept
            else:
                data.pop("keywords", None)
            save_json(package_json_path, data)
            modified += 1

    return modified


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Safely remove support:/lifecycle: keywords from package.json files")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be changed without making changes")
    args = parser.parse_args()

    problems = run_preflight_check(repo_root)
    if problems:
        sys.exit(1)

    modified = remove_support_lifecycle_keywords(repo_root, dry_run=not args.yes)
    if args.yes:
        print(f"\n✅ Done. Files modified: {modified}")
        print(f"\n💡 Note: YAML files in catalog-entities/marketplace/packages/ are now")
        print(f"   the single source of truth for support and lifecycle metadata.")
    else:
        print(f"\nℹ️ Dry run complete. Files that would be modified: {modified}")


if __name__ == "__main__":
    main()
