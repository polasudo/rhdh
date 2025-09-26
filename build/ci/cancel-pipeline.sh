#!/usr/bin/env bash
#
# Copyright (c) 2023-2024 Red Hat, Inc.
# 
# method to cancel a pipeline if nothing to do
# thanks to https://gitlab.com/gitlab-org/gitlab/-/issues/292816
# needs to be run inside a Gitlab runner, but a similar curl could be done from anywhere if you have the right token, URL, and IDs

set -x 

if [[ $PRIVATE_TOKEN ]] && [[ $CI_API_V4_URL ]] && [[ $CI_PROJECT_ID ]] && [[ $CI_JOB_ID ]]; then
    echo "To erase pipeline, artifacts and log:"
    echo "  curl --request POST --header \"PRIVATE-TOKEN: PRIVATE_TOKEN\" \"${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/jobs/${CI_JOB_ID}/erase\""
    echo "Pipeline cancelled with:"
    echo "  curl --request POST --header \"PRIVATE-TOKEN: PRIVATE_TOKEN\" \"${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/jobs/${CI_JOB_ID}/cancel\""
    curl --request POST --header "PRIVATE-TOKEN: ${PRIVATE_TOKEN}" "${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/jobs/${CI_JOB_ID}/cancel"
fi