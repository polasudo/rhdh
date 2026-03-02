import { existsSync, readFileSync, statSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";

const usageMessage = `

Usage: node licenseCheck --sbom <path/to/sbom.json> [--baselineSBOM <path/to/older-sbom.json>]
       node licenseCheck --sbom-dir <directory>

Options:
  --sbom <path>            Path to a single SBOM JSON file (mutually exclusive with --sbom-dir)
  --sbom-dir <directory>   Directory containing *.sbom.json files (mutually exclusive with --sbom)
  --baselineSBOM <path>    Path to a baseline SBOM JSON file (only with --sbom)
  --help                   Show this help message
`;
const options = {
  sbom: { type: "string", short: "s" },
  "sbom-dir": { type: "string", short: "d" },
  baselineSBOM: { type: "string", short: "b" },
};

const {
  values: { sbom, "sbom-dir": sbomDir, baselineSBOM },
} = parseArgs({ options });

if (!sbom && !sbomDir) {
  console.error(usageMessage);
  process.exit(1);
}

if (sbom && sbomDir) {
  console.error(`
    Error: --sbom and --sbom-dir are mutually exclusive.
    ${usageMessage}
  `);
  process.exit(1);
}

if (sbomDir && baselineSBOM) {
  console.error(`
    Error: --baselineSBOM is not supported with --sbom-dir.
    ${usageMessage}
  `);
  process.exit(1);
}

/* Array of licenses that are not in Fedora list */
const exceptionLicenses = [
  "Python-2.0", // Doesn't match the SPDX identifier - https://spdx.org/licenses/PSF-2.0.html
];

/* Allowed status values for fedora licenses in https://gitlab.com/fedora/legal/fedora-license-data/-/blob/main/tools/mkjson.py */
const allowed_values = new Set([
  "allowed",
  "allowed-content",
  "allowed-documentation",
  "allowed-fonts",
  "allowed-firmware",
]);

const approvedLicenses = await fetchApprovedLicenses();

const combinedApprovedLicenses = new Set([
  ...approvedLicenses,
  ...exceptionLicenses,
]);

const baselineSBOMData = loadBaselineSBOM();

if (sbomDir) {
  const exitCode = processSbomDirectory(sbomDir, combinedApprovedLicenses);
  process.exit(exitCode);
} else {
  const exitCode = processSingleSbom(
    sbom,
    combinedApprovedLicenses,
    baselineSBOMData
  );
  process.exit(exitCode);
}

function loadBaselineSBOM() {
  if (!baselineSBOM) {
    console.info("No baseline SBOM provided, skipping baseline SBOM check.");
    return null;
  }
  
  const baselineSBOMPath = resolve(baselineSBOM);
  if (!existsSync(baselineSBOMPath)) {
    console.error(`Baseline SBOM file does not exist: ${baselineSBOMPath}`);
    process.exit(1);
  }

  try {
    return JSON.parse(readFileSync(baselineSBOMPath, "utf-8"));
  } catch (error) {
    console.error(
      "Error reading or parsing baseline SBOM:",
      error.message
    );
    process.exit(1);
  }
}

function processSingleSbom(sbomFile, approvedLicenses, baselineSBOMData) {
  const sbomPath = resolve(sbomFile);
  if (!existsSync(sbomPath)) {
    console.error(`SBOM file does not exist: ${sbomPath}`);
    process.exit(1);
  }

  let sbomData;
  try {
    sbomData = JSON.parse(readFileSync(sbomPath, "utf-8"));
  } catch (error) {
    console.error("Error reading or parsing SBOM:", error.message);
    process.exit(1);
  }

  const filtered = checkSbom(sbomData, approvedLicenses, baselineSBOMData);

  if (filtered.length === 0) {
    console.log("No components with unapproved licenses found.");
    return 0;
  } else {
    displayFilteredComponents(filtered);
    return 1;
  }
}

function processSbomDirectory(dir, approvedLicenses) {
  const resolvedDir = resolve(dir);
  if (!existsSync(resolvedDir) || !statSync(resolvedDir).isDirectory()) {
    console.error(`SBOM directory does not exist: ${resolvedDir}`);
    process.exit(1);
  }

  const sbomFiles = readdirSync(resolvedDir)
    .filter((f) => f.endsWith(".sbom.json"))
    .sort();

  if (sbomFiles.length === 0) {
    console.error(`No *.sbom.json files found in ${resolvedDir}`);
    process.exit(1);
  }

  const results = [];

  for (const file of sbomFiles) {
    const filePath = join(resolvedDir, file);
    let sbomData;

    try {
      sbomData = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch (error) {
      console.error(`Error parsing ${file}: ${error.message}`);
      results.push({ file, unapproved: [], error: error.message });
      continue;
    }

    const filtered = checkSbom(sbomData, approvedLicenses, null);

    const countLabel =
      filtered.length > 0 ? ` (${filtered.length} unapproved)` : "";

    console.log("========================================");
    console.log(`Checking: ${file}${countLabel}`);
    console.log("========================================");

    if (filtered.length === 0) {
      console.log("No components with unapproved licenses found.");
    } else {
      displayFilteredComponents(filtered);
    }
    console.log("");

    results.push({ file, unapproved: filtered });
  }

  printSummary(results);

  const hasFailures = results.some((r) => r.unapproved.length > 0 || r.error);
  return hasFailures ? 1 : 0;
}

function checkSbom(sbomData, approvedLicenses, baselineSBOMData) {
  const components = sbomData.components || [];

  if (baselineSBOMData) {
    const baselineComponentsPurls = new Set(
      baselineSBOMData.components.map((component) => component.purl)
    );
    const newComponents = components.filter(
      (component) => !baselineComponentsPurls.has(component.purl)
    );
    return filterComponentsWithUnapprovedLicenses(
      newComponents,
      approvedLicenses
    );
  }

  return filterComponentsWithUnapprovedLicenses(components, approvedLicenses);
}

function printSummary(results) {
  const passed = results.filter(
    (r) => r.unapproved.length === 0 && !r.error
  );
  const failed = results.filter(
    (r) => r.unapproved.length > 0 || r.error
  );

  console.log("=== Summary ===");
  console.log(`Total SBOMs checked: ${results.length}`);
  console.log(`  Passed: ${passed.length}`);
  console.log(`  Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log("");

    for (const result of failed) {
      if (result.error) {
        console.log(`--- ${result.file} (parse error) ---`);
        console.log(`  Error: ${result.error}`);
      } else {
        console.log(
          `--- ${result.file} (${result.unapproved.length} unapproved) ---`
        );
        for (const component of result.unapproved) {
          const name = component.name || "N/A";
          const version = component.version || "N/A";
          const licenses = (component.licenses || [])
            .map((l) => l.license?.id || "Unknown")
            .join(", ");
          console.log(`  - ${name}@${version}    License: ${licenses}`);
        }
      }
      console.log("");
    }
  }
}

async function fetchApprovedLicenses() {
  try {
    const response = await fetch(
      "https://gitlab.com/fedora/legal/fedora-license-data/-/jobs/artifacts/main/raw/fedora-licenses.json?job=json"
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch approved licenses: ${response.statusText}`
      );
    }
    const licenseData = await response.json();

    return Object.values(licenseData)
      .filter((license) =>
        license.license.status.every((status) =>
          allowed_values.has(status)
        )
      )
      .map((license) => license.license.expression);
  } catch (error) {
    console.error("Error fetching approved licenses:", error.message);
    process.exit(1);
  }
}

function filterComponentsWithUnapprovedLicenses(components, approvedLicenses) {
  return components.filter((component) => {
    const licenses = component.licenses || [];
    return licenses.some((license) =>
      isUnapprovedLicense(license, approvedLicenses)
    );
  });
}

function isUnapprovedLicense(license, approvedLicenses) {
  if (!license || !license.license || !license.license.id) {
    return false;
  }
  // Check against the combined set of approved and exception licenses
  return !approvedLicenses.has(license.license.id);
}

function displayFilteredComponents(components) {
  console.table(
    components.map((component) => ({
      "Component Name": component.name || "N/A",
      pURL: component.purl || "N/A",
      License: (component.licenses || [])
        .map((license) => license.license.id || "Unknown")
        .join(", "),
      Location:
        component.properties?.find(
          (prop) => prop.name === "syft:location:0:path"
        )?.value || "N/A",
    }))
  );
}
