# SBOM License Checker

A tool to analyze the licenses of components listed in a Software Bill of Materials (SBOM) generated from a container image, identifying any that are not approved by Fedora standards.

## Overview

This project includes a Bash script and a Node.js tool:

1. `generateSBOM.sh`: Pulls the container image, generates an SBOM using `syft`, and saves it as a `.json` file.
2. `licenseCheck.js`: Analyzes the SBOM JSON file and checks the licenses against the approved licenses list from Fedora License Data.

## Prerequisites

- `generateSBOM.sh`:
  - `podman` for container management
  - `syft` for generating the SBOM
- `licenseCheck.js`:
  - Node.js (v18 or later)

## Usage

### Step 1: Generate the SBOM

Use the Bash script to pull a container image and generate its SBOM in CycloneDX JSON format.

```bash
./generateSBOM.sh <full_image_name>
```

- `<full_image_name>`: The full name of the container image (e.g., `registry.redhat.io/rhdh/rhdh-hub-rhel9:1.3-100`).

The script will:

1. Pull the specified container image.
2. Extract its ID.
3. Save the image to a `.tar` file.
4. Generate an SBOM in CycloneDX JSON format.

### Step 2: Analyze the SBOM

Run the Node.js script to analyze the SBOM for unapproved licenses.

- `<path/to/sbom.json>`: Path to the generated SBOM JSON file from Step 1.
- `<path/to/older-sbom.json>`: Optional path to a baseline SBOM JSON file for comparison.

### Example Workflow

1. Generate the SBOM:

    ```bash
    ./generateSBOM.sh registry.redhat.io/rhdh/rhdh-hub-rhel9:1.3-100
    ```

    This will create a file named `rhdh-hub-rhel9-1.3-100.sbom.json`.

2. Analyze the SBOM:

    ```bash
    node licenseCheck --sbom rhdh-hub-rhel9-1.3-100.sbom.json
    ```

    This will check the licenses in the SBOM against the approved licenses from Fedora.

3. Parsing the results
  
    If the script successfully verified all licenses are approved, it should output:

    ```bash
    No components with unapproved licenses found.
    ```

    Otherwise, it will generate a table containing the component name, package url, license and location of every package with an unapproved license.
