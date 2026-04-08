#!/bin/bash
#
# RHDH PipelineRun generator
#
# Generates push and pull_request PipelineRun files for each component defined
# in .tekton-templates/components.yaml. Hub and operator share a single template
# (rhdh-pipeline.yaml) with conditional task blocks; operator-bundle has its own
# template due to fundamentally different task bundles (non-OCI trusted artifacts).
#
# Also updates FBC pipeline files to use the correct target_branch.
#
# Templates are in .tekton-templates/ and use these placeholders:
#   {{VERSION_DASH}}, {{VERSION_DOT}}, {{EVENT_TYPE}}, {{EVENT_SUFFIX}}
#   {{COMPONENT}}, {{OUTPUT_IMAGE}}, {{PATH_CONTEXT}}, {{PREFETCH_INPUT}}
#   {{MAX_KEEP_RUNS}}, {{SNYK_PROJECT}}, {{STORAGE}}
#
# Conditional task blocks are wrapped in:
#   # BEGIN_TASK <task-name> ... # END_TASK <task-name>

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/../.tekton-templates"
CONFIG_FILE="$TEMPLATE_DIR/components.yaml"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No colour

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

while [[ "$#" -gt 0 ]]; do
  case $1 in
	'-t') VERSION_DOT="$2"; shift 1;;
	'-h'|'--help') usage;;
    *) echo "Unknown parameter used: $1."; usage; exit 1;;
  esac
  shift 1
done

if ! command -v yq &>/dev/null; then
    echo -e "${RED}Error: yq is required but not found in PATH${NC}"
    exit 1
fi

VERSION_DASH="${VERSION_DOT/./-}" # e.g. 1.10 -> 1-10
TARGET_BRANCH="rhdh-${VERSION_DOT}-rhel-9" # e.g. rhdh-1.10-rhel-9

echo -e "${BLUE}Creating RHDH version: ${GREEN}$VERSION_DOT${NC}"
echo -e "${BLUE}Target branch: ${GREEN}$TARGET_BRANCH${NC}"
echo ""

# All conditional task names that may appear in templates
ALL_CONDITIONAL_TASKS=("publish-helm" "ecosystem-cert-preflight-checks")

create_component_pipeline() {
    local component="$1"
    local event_suffix="$2"
    local template_name output_file event_type

    template_name=$(yq ".$component.template" "$CONFIG_FILE")
    output_file="$SCRIPT_DIR/rhdh-${component}-${VERSION_DASH}-${event_suffix}.yaml"

    if [ ! -f "$TEMPLATE_DIR/$template_name" ]; then
        echo -e "${RED}✗ Template not found: $TEMPLATE_DIR/$template_name${NC}"
        return 1
    fi

    if [ "$event_suffix" = "push" ]; then
        event_type="push"
    else
        event_type="pull_request"
    fi

    local output_image path_context prefetch_input max_keep_runs snyk_project storage
    output_image=$(yq ".$component.output_image" "$CONFIG_FILE")
    path_context=$(yq ".$component.path_context" "$CONFIG_FILE")
    prefetch_input=$(yq ".$component.prefetch_input" "$CONFIG_FILE")
    max_keep_runs=$(yq ".$component.max_keep_runs" "$CONFIG_FILE")
    snyk_project=$(yq ".$component.snyk_project" "$CONFIG_FILE")
    storage=$(yq ".$component.storage" "$CONFIG_FILE")

    local include_tasks
    include_tasks=$(yq ".$component.include_tasks[]" "$CONFIG_FILE" 2>/dev/null || true)

    cp "$TEMPLATE_DIR/$template_name" "$output_file"

    # For templates with conditional task blocks, remove tasks not in include_tasks
    for task_name in "${ALL_CONDITIONAL_TASKS[@]}"; do
        if ! echo "$include_tasks" | grep -q "^${task_name}$"; then
            sed -i "/# BEGIN_TASK ${task_name}/,/# END_TASK ${task_name}/d" "$output_file"
        else
            sed -i "/# BEGIN_TASK ${task_name}/d; /# END_TASK ${task_name}/d" "$output_file"
        fi
    done

    # Use | as delimiter since prefetch_input contains slashes, brackets, etc.
    sed -i \
        -e "s|{{VERSION_DASH}}|$VERSION_DASH|g" \
        -e "s|{{VERSION_DOT}}|$VERSION_DOT|g" \
        -e "s|{{EVENT_TYPE}}|$event_type|g" \
        -e "s|{{EVENT_SUFFIX}}|$event_suffix|g" \
        -e "s|{{COMPONENT}}|$component|g" \
        -e "s|{{OUTPUT_IMAGE}}|$output_image|g" \
        -e "s|{{PATH_CONTEXT}}|$path_context|g" \
        -e "s|{{MAX_KEEP_RUNS}}|$max_keep_runs|g" \
        -e "s|{{SNYK_PROJECT}}|$snyk_project|g" \
        -e "s|{{STORAGE}}|$storage|g" \
        "$output_file"

    # prefetch_input may contain special chars; use a different approach
    local escaped_prefetch
    escaped_prefetch=$(printf '%s\n' "$prefetch_input" | sed 's/[&/\]/\\&/g')
    sed -i "s|{{PREFETCH_INPUT}}|${escaped_prefetch}|g" "$output_file"

    echo -e "${GREEN}✓${NC} Created: ${BLUE}rhdh-${component}-${VERSION_DASH}-${event_suffix}.yaml${NC} (from ${template_name})"
}

update_fbc_pipeline() {
    local fbc_file="$1"

    if [ ! -f "$fbc_file" ]; then
        echo -e "${RED}✗ FBC file not found: $fbc_file${NC}"
        return 1
    fi

    sed -i -e "s/== \"rhdh-1-rhel-9\"/== \"${TARGET_BRANCH}\"/g" "$fbc_file" 2>/dev/null
    sed -i -e "s/on-push-for-rhdh-1-rhel-9/on-push-for-${TARGET_BRANCH}/g" "$fbc_file" 2>/dev/null

    echo -e "${GREEN}✓${NC} Updated: ${BLUE}$(basename "$fbc_file")${NC} -> target_branch: ${TARGET_BRANCH}"
}

# Generate push and pull variants for all components
echo -e "${BLUE}Generating RHDH component pipelines (push + pull)...${NC}"
COMPONENTS=$(yq 'keys | .[]' "$CONFIG_FILE")
for component in $COMPONENTS; do
    for event in push pull; do
        if ! create_component_pipeline "$component" "$event"; then
            echo -e "${RED}✗ Failed to generate $event pipeline for: $component${NC}"
            exit 1
        fi
    done
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

echo -e "${GREEN}Done!${NC}"
