#!/bin/bash
#
# RHDH PipelineRun generator
#
# Creates 3 component-specific pipelinerun files:
#   - rhdh-hub-{version}.yaml
#   - rhdh-operator-{version}.yaml
#   - rhdh-operator-bundle-{version}.yaml
#
# utility script to (re)generate pipeline runs; each plr handles both push and pull_request events using CEL expressions.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/../.tekton-templates"

usage() {
	echo "
Utility script to generate new pipelineruns when branching

Usage:    $0 -t <new_branch>

Example:  $0 -t 1.9
"
}

if [[ $# -lt 2 ]]; then 
	usage
	exit 1
fi

# commandline args
while [[ "$#" -gt 0 ]]; do
  case $1 in
	'-t') VERSION_DOT="$2"; shift 1;; # 1.y 
	'-h'|'--help') usage;;
    *) echo "Unknown parameter used: $1."; usage; exit 1;;
  esac
  shift 1
done


# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VERSION_DASH="${VERSION_DOT/./-}" # 1.9 -> 1-9

echo -e "${BLUE}Creating RHDH version: ${GREEN}$VERSION_DOT${NC}"
echo ""

# Function to replace template variables and create component-specific files
create_component_pipeline() {
    local component="$1"
    local template_file="$TEMPLATE_DIR/rhdh-${component}.yaml"
    local output_file="$SCRIPT_DIR/rhdh-${component}-${VERSION_DASH}.yaml"

    if [ ! -f "$template_file" ]; then
        echo -e "${RED}✗ Error: Template file not found: $template_file${NC}"
        return 1
    fi

    # Copy template
    cp "$template_file" "$output_file" 2>/dev/null

    # Replace version placeholders
    sed -i -e "s/{{VERSION_DASH}}/$VERSION_DASH/g" -e "s/{{VERSION_DOT}}/$VERSION_DOT/g" "$output_file" 2>/dev/null

    echo -e "${GREEN}✓${NC} Created: ${BLUE}rhdh-${component}-${VERSION_DASH}.yaml${NC}"
}

# Create all three component pipelines
for plr in hub operator operator-bundle; do 
    # echo -e "${NC}Generate $plr pipelinerun...${NC}"
    create_component_pipeline "$plr"
done

# remove unneeded pipelineruns from the stable branch
# TODO when we move to 2.y this needs to match -2.yaml
rm -f "$SCRIPT_DIR"/*-1.yaml