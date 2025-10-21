#!/bin/bash
#
# RHDH Pipeline Version Creator
# Creates new pipeline versions using unified pipeline approach
#
# Usage: ./create-new-version.sh <new_version>
# Example: ./create-new-version.sh 1-8

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/templates"
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

echo "Creating RHDH version: $NEW_VERSION"

# Function to replace template variables and create files
create_pipeline_run() {
    local event_type="$1"
    local template_file="$TEMPLATE_DIR/rhdh-1.yaml"
    local output_file="$SCRIPT_DIR/rhdh-$NEW_VERSION-$event_type.yaml"

    if [ ! -f "$template_file" ]; then
        echo -e "${RED}Error: Template file not found: $template_file${NC}"
        return 1
    fi

    # Copy template and replace variables (quiet)
    cp "$template_file" "$output_file" 2>/dev/null

    # Replace version placeholders
    sed -i.bak "s/{{VERSION_DASH}}/$NEW_VERSION/g" "$output_file" 2>/dev/null
    sed -i.bak "s/{{VERSION_DOT}}/$VERSION_DOT/g" "$output_file" 2>/dev/null

    # Replace event-specific placeholders
    if [ "$event_type" = "push" ]; then
        sed -i.bak "s/{{EVENT_TYPE}}/push/g; s/{{EVENT_TYPE_DASH}}/push/g; s/{{MAX_KEEP_RUNS}}/8/g; s/{{IMAGE_TAG}}/{{revision}}/g; s/{{IMAGE_EXPIRES_AFTER}}/''/g; s/{{PIPELINE_TIMEOUT}}/3h/g" "$output_file" 2>/dev/null
    else
        sed -i.bak "s/{{EVENT_TYPE}}/pull_request/g; s/{{EVENT_TYPE_DASH}}/pull-request/g; s/{{MAX_KEEP_RUNS}}/7/g; s/{{IMAGE_TAG}}/on-pr-{{revision}}/g; s/{{IMAGE_EXPIRES_AFTER}}/2w/g; s/{{PIPELINE_TIMEOUT}}/3h/g" "$output_file" 2>/dev/null
    fi

    # Replace resource placeholders (using hub defaults)
    sed -i.bak "s/{{BUILD_CPU_REQUEST}}/8/g; s/{{BUILD_CPU_LIMIT}}/8/g; s/{{BUILD_MEMORY_REQUEST}}/20Gi/g; s/{{BUILD_MEMORY_LIMIT}}/20Gi/g; s/{{PREFETCH_CPU_REQUEST}}/8/g; s/{{PREFETCH_CPU_LIMIT}}/8/g; s/{{PREFETCH_MEMORY_REQUEST}}/12Gi/g; s/{{PREFETCH_MEMORY_LIMIT}}/12Gi/g; s/{{WORKSPACE_SIZE}}/5Gi/g" "$output_file" 2>/dev/null

    # Clean up backup files
    rm -f "$output_file.bak" 2>/dev/null

    echo "Created: rhdh-$NEW_VERSION-$event_type.yaml"
}

# Create both push and pull PipelineRuns
create_pipeline_run "push"
create_pipeline_run "pull-request"

echo ""
echo "Version $NEW_VERSION created successfully"
echo "Files: rhdh-$NEW_VERSION-push.yaml, rhdh-$NEW_VERSION-pull-request.yaml"
