const fs = require("node:fs");
const path = require("node:path");
const { parseArgs } = require("node:util");

const options = {
  sbom: { type: "string", short: "s" },
  baselineSBOM: { type: "string", short: "b" },
};

const {
  values: { sbom, baselineSBOM },
} = parseArgs({ options });

if (!sbom) {
  console.error(
    "Usage: node licenseCheck --sbom <path/to/sbom.json> [--baselineSBOM <path/to/older-sbom.json>]"
  );
  process.exit(1);
}

const sbomPath = path.resolve(sbom);
const baselineSBOMPath = baselineSBOM ? path.resolve(baselineSBOM) : null;

if (
  !fs.existsSync(sbomPath) ||
  (baselineSBOMPath && !fs.existsSync(baselineSBOMPath))
) {
  console.error("One or both input files do not exist");
  process.exit(1);
}

let sbomData, baselineSBOMData;

try {
  sbomData = JSON.parse(fs.readFileSync(sbomPath, "utf-8"));
  if (baselineSBOMPath) {
    baselineSBOMData = JSON.parse(fs.readFileSync(baselineSBOMPath, "utf-8"));
  }
} catch (error) {
  console.error(
    "Error reading or parsing one of the input files:",
    error.message
  );
  process.exit(1);
}

/* main code */
(async () => {
  const approvedLicenses = await fetchApprovedLicenses();

  const combinedApprovedLicenses = new Set([
    ...approvedLicenses,
    ...exceptionLicenses,
  ]);

  const components = sbomData.components || [];
  let filteredComponents;

  if (baselineSBOMData) {
    const baselineComponentsPurls = new Set(
      baselineSBOMData.components.map((component) => component.purl)
    );
    const newComponents = components.filter(
      (component) => !baselineComponentsPurls.has(component.purl)
    );
    filteredComponents = filterComponentsWithUnapprovedLicenses(
      newComponents,
      combinedApprovedLicenses
    );
  } else {
    filteredComponents = filterComponentsWithUnapprovedLicenses(
      components,
      combinedApprovedLicenses
    );
  }

  if (filteredComponents.length === 0) {
    console.log("No components with unapproved licenses found.");
  } else {
    displayFilteredComponents(filteredComponents);
  }
})();

/* Array of licenses that are not in Fedora list */
const exceptionLicenses = [
  "Python-2.0", // Doesn't match the SPDX identifier - https://spdx.org/licenses/PSF-2.0.html
];

/* Allowed status values for fedora licenses in https://gitlab.com/fedora/legal/fedora-license-data/-/blob/main/tools/mkjson.py */
const allowed_values = [
  "allowed",
  "allowed-content",
  "allowed-documentation",
  "allowed-fonts",
  "allowed-firmware",
]

/* Fetches the Fedora license data */
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
      .filter((license) => license.license.status.every(
          (status) => allowed_values.includes(status)
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
