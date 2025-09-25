#!/bin/bash
#
# Copyright (c) Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# for a given CVE, compute the RHSA/RHBA advistory 

CVEListFile=""
CVE_ID=""
DO_ALL=0
QUIET=0

usage () {
	echo "Usage:
    
  $0 -v 1.y -f  /path/to/RHDH CVE Management - 1.y.z.csv
  $0 -v 1.y CVE-yyyy-12345 [CVE-yyyy-23456 ...]

Examples:
  $0 -v 1.5 -f /path/to/RHDH\ CVE\ Management\ -\ 1.5.1.csv
  $0 -v 1.4 -f /path/to/RHDH\ CVE\ Management\ -\ 1.4.3.csv

  $0 -v 1.5 CVE-2024-56326 -q
  $0 -v 1.4 CVE-2025-29775 -q

Options:
  -v               RHDH version x.y
  -f               file containing csv formatted exported list of CVEs
                   NOTE: only CVEs with Status = Done will be processed; CVEs with Status = 'Won't Do' or 'Not a Bug' will be skipped
  --all            if CVE file contains more than one CVE, process all; default is to only process the first one (as they should all be the same)
  -q               quieter output
  -h, --help       this help
"
}

if [[ $# -lt 1 ]]; then usage; fi

while [[ "$#" -gt 0 ]]; do
    case $1 in
        '-v')      RHDH_VERSION="$2"; shift 1;;
        '-f')      CVEListFile="$2"; shift 1;;
        '--all')   DO_ALL=1;; 
        '-q') QUIET=1;;
        '-h'|'--help')       usage; exit 0;;
        *)                   CVE_ID="${CVE_ID} $1";;
    esac
    shift 1
done

if [[ ! $RHDH_VERSION ]]; then usage; exit 1; fi
if [[ ! $CVEListFile ]] && [[ ! $CVE_ID ]]; then usage; exit 1; fi

if [[ -f $CVEListFile ]]; then 
      # read CVEListFile: find the CVE (2), and Resolution (7) columns; combine with " ; "; strip spaces; omit the header row with tail
    for line in $(awk -F "\"*,\"*" '{print $2,";",$7}' "$CVEListFile" | tr -d " " | tail --lines=+2); do 
        # echo $line
        CVE_STATUS="$(echo "${line#*;}" | tr -d '\n')"
        if [[ $CVE_STATUS != *"ReleasePending"* ]] && [[ $CVE_STATUS != "Done"* ]]; then
            # echo "[WARN] Skip $line"
            true
        else
            CVE_ID="${CVE_ID} ${line%;*}"
            if [[ $DO_ALL -eq 0 ]]; then break; fi
        fi
    done
fi

# echo "[DEBUG] Got the following CVE(s):"
# echo "[DEBUG] $CVE_ID"

for cve in $CVE_ID; do
    cve_year=${cve%-*}; cve_year=${cve_year/CVE-}
    cve_url="https://security.access.redhat.com/data/csaf/v2/vex/${cve_year}/${cve,,}.json"
    if [[ $QUIET -eq 0 ]]; then 
        echo -e -n " > $cve_url \n = "
    fi
    CVE_URL=$(curl -sSkLo- "$cve_url" | grep "${RHDH_VERSION}:registry" -B3 -A3 | grep "errata/RHSA" | sed -r -e 's|.+"url": "(.+)"|\1|')
    if [[ $CVE_URL ]]; then
        echo "$CVE_URL"
    fi
done
