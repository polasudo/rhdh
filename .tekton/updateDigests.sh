#!/bin/bash
#
# Copyright (c) 2024 Red Hat, Inc.
#
# update pipelines to latest digests
#
# requires yq (python wrapper for jq)

# set -x
set -e

SCRIPT=$(readlink -f "$0")
ROOTPATH=$(dirname "$SCRIPT"); 

norm="\033[0;39m"
green="\033[1;32m"
blue="\033[1;34m"
red="\033[1;31m"

# mappings of base -> new SHA
declare -A digests

# file counters: tf, cf
tf=0; cf=0

for file in $(find "$ROOTPATH" -name "*yaml"); do 
    (( tf = tf + 1 ))
done

mkfifo mypipe 2>/dev/null || true
for file in $(find "$ROOTPATH" -name "*yaml" | sort -V); do 
    (( cf = cf + 1 ))
    # line counters: tl, cl
    tl=0; cl=0

    echo -e "[$cf/$tf] ${red}>${norm} $file"
    grep @sha256 < "$file" | sort -uV > mypipe &
    while IFS= read -r line; do
        if [[ $line != "value:" ]]; then
            (( tl = tl + 1 ))
        fi
    done < mypipe
    grep @sha256 < "$file" | sort -uV > mypipe &
    while IFS= read -r line; do
        line="${line##*value: }"
        (( cl = cl + 1 ))
        # echo "[DEBUG] [$cf/$tf] [$cl/$tl] $line"
        base=${line%%@sha256:*};                                       # echo "[DEBUG]     base: $base"
        oldSHA=${line##*@};                                            # echo "[DEBUG]     OLD SHA: $oldSHA"
        if [[ ! "${digests["$base"]}" ]]; then 
            newSHA=$(skopeo inspect "docker://$base" | jq -r '.Digest');   # echo "[DEBUG]     NEW SHA: $newSHA"
        else
            newSHA="${digests["$base"]}"
        fi
        digests["$base"]="$newSHA"
        if [[ "$oldSHA" != "$newSHA" ]]; then
            sed -i "$file" -r -e "s|$oldSHA|$newSHA|g"
            echo -e "[$cf/$tf] [$cl/$tl] ${green}+${norm} $(echo "$line" | sed -r -e "s|$oldSHA|$newSHA|g")"
        else
            echo -e "[$cf/$tf] [$cl/$tl] ${blue}=${norm} $line"
        fi
    done < mypipe
done
rm -f mypipe
echo; echo "Changes:"
git diff "$ROOTPATH/*.yaml" | grep value: | sort -uV | grep +
echo; echo "Changed files:"
git diff  --name-only "$ROOTPATH/*.yaml"
