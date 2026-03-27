#!/bin/bash
#
# RHDH PipelineRun generator
#
# Creates 3 component-specific pipelinerun files:
#   - rhdh-hub-{version}.yaml
#   - rhdh-operator-{version}.yaml
#   - rhdh-operator-bundle-{version}.yaml
#
# Also updates FBC pipeline files to use the correct target_branch
#
# utility script to (re)generate pipeline runs; each plr handles both push and pull_request events using CEL expressions.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/../.tekton-templates"

usage() {
	echo "
Utility script to generate new pipelineruns when branching

Usage:    $0 -t <new_branch>

Example:  $0 -t 1.10
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
TARGET_BRANCH="rhdh-${VERSION_DOT}-rhel-9"

echo -e "${BLUE}Creating RHDH version: ${GREEN}$VERSION_DOT${NC}"
echo -e "${BLUE}Target branch: ${GREEN}$TARGET_BRANCH${NC}"
echo ""

# Function to replace template variables and create component-specific files
create_component_pipeline() {
    local component="$1"
    local template_file="$TEMPLATE_DIR/rhdh-${component}.yaml"
    local output_file="$SCRIPT_DIR/rhdh-${component}-${VERSION_DASH}"

    if [ ! -f "$template_file" ]; then
        echo -e "${RED}✗ Error: Template file not found: $template_file${NC}"
        return 1
    fi

    # Replace version and EVENT placeholders in templaces
    sed "$template_file" \
        -e "s/{{VERSION_DASH}}/$VERSION_DASH/g" -e "s/{{VERSION_DOT}}/$VERSION_DOT/g" \
        -e "s/{{EVENTNAME}}/pull/" -e "s/{{EVENT}}/pull_request/" \
        2>/dev/null > "${output_file}-pull.yaml"
    sed "$template_file" \
        -e "s/{{VERSION_DASH}}/$VERSION_DASH/g" -e "s/{{VERSION_DOT}}/$VERSION_DOT/g" \
        -e "s/{{EVENTNAME}}/push/" -e "s/{{EVENT}}/push/" \
        2>/dev/null > "${output_file}-push.yaml"

    echo -e "${GREEN}✓${NC} Created: ${BLUE}rhdh-${component}-${VERSION_DASH}-push.yaml and -pull.yaml${NC}"
}

# Function to update FBC pipeline target_branch
update_fbc_pipeline() {
    local fbc_file="$1"
    
    if [ ! -f "$fbc_file" ]; then
        echo -e "${RED}✗ Error: FBC file not found: $fbc_file${NC}"
        return 1
    fi

    # Update target_branch in CEL expression from rhdh-1-rhel-9 to rhdh-{VERSION_DOT}-rhel-9
    sed -i -e "s/== \"rhdh-1-rhel-9\"/== \"${TARGET_BRANCH}\"/g" "$fbc_file" 2>/dev/null

    # Update image tag from on-push-for-rhdh-1-rhel-9 to on-push-for-rhdh-{VERSION_DOT}-rhel-9
    sed -i -e "s/on-push-for-rhdh-1-rhel-9/on-push-for-${TARGET_BRANCH}/g" "$fbc_file" 2>/dev/null

    echo -e "${GREEN}✓${NC} Updated: ${BLUE}$(basename "$fbc_file")${NC} -> target_branch: ${TARGET_BRANCH}"
}

# Create all three component pipelines
echo -e "${BLUE}Generating RHDH component pipelines...${NC}"
for plr in hub operator operator-bundle; do 
    if ! create_component_pipeline "$plr"; then
        echo -e "${RED}✗ Failed to generate pipeline for component: $plr${NC}"
        exit 1
    fi
done

echo ""

# Update FBC pipelines target_branch
echo -e "${BLUE}Updating FBC pipelines target_branch...${NC}"
for fbc_file in "$SCRIPT_DIR"/fbc-*-push.yaml; do
    if [ -f "$fbc_file" ]; then
        if ! update_fbc_pipeline "$fbc_file"; then
            echo -e "${RED}✗ Failed to update FBC pipeline: $fbc_file${NC}"
            exit 1
        fi
    fi
done

echo ""

# remove unneeded pipelineruns from the stable branch
# TODO when we move to 2.y this needs to match -2.yaml
if [[ $VERSION_DOT != 1 ]]; then
    rm -f "$SCRIPT_DIR"/*-1.yaml "$SCRIPT_DIR"/*-1-push.yaml  "$SCRIPT_DIR"/*-1-pull.yaml
fi

echo -e "${GREEN}Done!${NC}"
