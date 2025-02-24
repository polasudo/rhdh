#!/bin/bash

if [[ ! $accessToken ]]; then 
  echo "[ERROR] You must export your quay API access token to run this script"; 
  echo "export accessToken=..."
  exit 1; 
fi

quayRepos=(rhdh-hub-rhel9 rhdh-rhel9-operator rhdh-operator-bundle iib)

for repo in "${quayRepos[@]}"
do
  echo "Clean up tags from quay.io/rhdh/$repo"
  json=$(mktemp)
  page=1
  curl -sS "https://quay.io/api/v1/repository/rhdh/${repo}/tag/?page=${page}&onlyActiveTags=true" > $json
  while [[ $(jq '.tags' $json) != "" ]] && [[ $(jq '.tags' $json) != "[]" ]]; do
    index=0
    while [[ $(jq ".tags[$index]" $json) != null ]]; do
      tag_date=$(jq ".tags[$index].last_modified" $json)
      tag_date=$(echo "$tag_date" | xargs)
      epoch_tag_date=$(date -d "${tag_date}" +"%s")
      epoch_8mo_ago=$(date -d "-8 months" +"%s")
      if [[ $epoch_8mo_ago -ge $epoch_tag_date ]]; then
        tag_name=$(jq ".tags[$index].name" $json)
        curl -sS -H "Authorization: Bearer ${accessToken}" -X DELETE https://quay.io/api/v1/repository/rhdh/${repo}/tag/${tag_name}
        echo "Deleted ${tag_name} from ${repo} (updated ${tag_date})."
      fi
      index=$(( index + 1 ))
    done

    page=$(( page + 1 ))
    curl -sS "https://quay.io/api/v1/repository/rhdh/${repo}/tag/?page=${page}&onlyActiveTags=true" > $json
    rm -f $json
  done
done