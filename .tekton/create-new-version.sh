#!/bin/bash
#
# RHDH Pipeline Version Creator
# Creates new pipeline versions using unified pipeline approach
#
# Usage: ./create-new-version.sh <new_version>
# Example: ./create-new-version.sh 1-8
#
# Creates 3 component-specific pipeline files:
#   - rhdh-hub-{version}.yaml
#   - rhdh-operator-{version}.yaml
#   - rhdh-operator-bundle-{version}.yaml
#
# Each file handles both push and pull_request events using CEL expressions.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/../templates"
NEW_VERSION="$1"

if [ -z "$NEW_VERSION" ]; then
    echo "Usage: $0 <new_version>"
    echo "Example: $0 1-8"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Convert version format (1-8 -> 1.8 for some contexts)
VERSION_DOT="${NEW_VERSION//-/.}"

echo -e "${BLUE}Creating RHDH version: ${GREEN}$NEW_VERSION${NC}"
echo ""

# Function to replace template variables and create component-specific files
create_component_pipeline() {
    local component="$1"
    local template_file="$TEMPLATE_DIR/rhdh-${component}.yaml"
    local output_file="$SCRIPT_DIR/rhdh-${component}-${NEW_VERSION}.yaml"

    if [ ! -f "$template_file" ]; then
        echo -e "${RED}✗ Error: Template file not found: $template_file${NC}"
        return 1
    fi

    # Copy template
    cp "$template_file" "$output_file" 2>/dev/null

    # Replace version placeholders
    sed -i.bak "s/{{VERSION_DASH}}/$NEW_VERSION/g" "$output_file" 2>/dev/null
    sed -i.bak "s/{{VERSION_DOT}}/$VERSION_DOT/g" "$output_file" 2>/dev/null

    # Clean up backup file
    rm -f "$output_file.bak" 2>/dev/null

    echo -e "${GREEN}✓${NC} Created: ${BLUE}rhdh-${component}-${NEW_VERSION}.yaml${NC}"
}

# Create all three component pipelines
echo -e "${YELLOW}Generating component pipeline files...${NC}"
create_component_pipeline "hub"
create_component_pipeline "operator"
create_component_pipeline "operator-bundle"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Version $NEW_VERSION created successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Generated files:${NC}"
echo -e "  • rhdh-hub-${NEW_VERSION}.yaml"
echo -e "  • rhdh-operator-${NEW_VERSION}.yaml"
echo -e "  • rhdh-operator-bundle-${NEW_VERSION}.yaml"
echo ""
echo -e "${YELLOW}Note:${NC} Each file handles both push and pull_request events"
echo -e "${YELLOW}Note:${NC} All files use shared pipeline: build-pipeline-rhdh"
echo ""
