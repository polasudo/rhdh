# SBOM License Checker

A tool to analyze the licenses of components listed in a Software Bill of Materials (SBOM) generated from RHDH container images, identifying any that are not approved by Fedora standards.

## Overview

This project includes a Bash script and a Node.js tool:

1. `generateSBOM.sh`: Pulls container images, generates SBOMs using `syft`, and saves them as `.json` files. Supports generating SBOMs for both the RHDH hub image and all plugin images listed in a catalog-index.
2. `licenseCheck.js`: Analyzes SBOM JSON files and checks the licenses against the approved licenses list from Fedora License Data. Supports checking a single file or an entire directory of SBOMs.

## Prerequisites

- `generateSBOM.sh`:
  - `podman` for container management
  - `syft` for generating the SBOM
  - `jq` for parsing the catalog-index (only required when using `--catalog-index`)
- `licenseCheck.js`:
  - Node.js (v18 or later)

## Usage

### Step 1: Generate the SBOM(s)

```bash
./generateSBOM.sh [OPTIONS]
```

| Flag | Description |
|---|---|
| `--image <ref>` | RHDH hub image reference |
| `--catalog-index <ref>` | Plugin catalog-index image reference |
| `--output-dir <path>` | Directory for generated SBOMs (default: `./sboms`) |
| `--help` | Show help message |

At least one of `--image` or `--catalog-index` must be provided. Both can be used together.

When `--catalog-index` is provided, the script pulls the `catalog-index` image, extracts its `index.json`, and generates an CycloneDX JSON formatted SBOM for every plugin listed via the `registryReference` fields in the `index.json`. It will use the `quay.io/rhdh` mirror for the plugins instead of the `registry.access.redhat.com/rhdh` registry due to the plugins not being available until AFTER GA.

### Step 2: Analyze the SBOM(s)

Run the Node.js script to analyze a single SBOM for unapproved licenses.

```bash
node licenseCheck --sbom <path/to/sbom.json> [--baselineSBOM <path/to/older-sbom.json>]
```

Check all SBOMs in a directory:

```bash
node licenseCheck --sbom-dir <directory>
```

| Flag | Description |
|---|---|
| `--sbom <path>` | Path to a single SBOM JSON file |
| `--sbom-dir <path>` | Directory containing `*.sbom.json` files |
| `--baselineSBOM <path>` | Optional baseline SBOM for comparison (only with `--sbom`) |

Note: `--sbom-dir` and `--sbom` arguments are mutually exclusive. `--baselineSBOM` is only supported with `--sbom`.

### Example Workflow

1. Generate SBOMs for the hub image and all catalog-index plugins:

  ```bash
  ./generateSBOM.sh \
    --image registry.redhat.io/rhdh/rhdh-hub-rhel9:1.10 \
    --catalog-index quay.io/rhdh/plugin-catalog-index:1.10 \
    --output-dir ./sboms
  ```

1. Check all generated SBOMs for unapproved licenses:

```bash
node licenseCheck --sbom-dir ./sboms
```

If all licenses are approved licenses from Fedora, the script outputs:

```
No components with unapproved licenses found.
```

When using `--sbom-dir`, a summary is printed at the end. The following example includes an unapproved license:

```
=== Summary ===
Total SBOMs checked: 87
  Passed: 85
  Failed: 2

--- backstage-community-plugin-foo.sbom.json (1 unapproved) ---
  - problematic-pkg@2.0.0    License: BCL
```