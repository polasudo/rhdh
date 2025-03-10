#!/bin/bash

PWD="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_STATE='RC'
BUNDLE_TAG=''
RHDH_VERSION=''
WEBHOOK_URL=''

usage() {
  echo "
  Utility script to send a slack notification to #forum-rhdh-releases regarding GA/RC builds
  
  Requires that you are already logged into the Konflux cluster via commandline, for example
   oc login --token=sha256~YOUR_TOKEN_HERE --server=https://api.stone-prod-p02.hjvn.p1.openshiftapps.com:6443

  To generate a token go to https://console-openshift-console.apps.stone-prod-p02.hjvn.p1.openshiftapps.com/k8s/cluster/projects/rhdh-tenant 
  Then click on your username and select 'Copy login command' then 'Display token'
  
  Usage:
    $0 [OPTIONS]
  
  Options:
    --release-state <release-state> : Release State (RC or GA) to be mentioned in the slack message. It is RC by default.
    --bundle-tag <bundle-tag> : Tag of the operator bundle to use. If not provided, the latest opertor bundle avialable of the given RHDH version will be used.
    --version <version> : RHDH version of the RC/GA build required.
    --slack-webhook <webhook> : Webhook to post a message to a given channel (For webhook for #forum-rhdh-releases, see bitwarden)

  Example:
    $0 --bundle-tag 1.5-155 --version 1.5 --slack-webhook https://hooks.slack.com/services/...
"
}

send_slack_message() {
  response=$(curl -s -w "%{http_code}" -X POST -H 'Content-type: application/json' --data "$PAYLOAD" "$WEBHOOK_URL")

  # Get the HTTP status code
  http_code="${response: -3}"

  # Check if the response code is 2xx (success)
  if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
    echo "[INFO] Slack message sent successfully."
  else
    echo "[ERROR] Failed to send Slack message. HTTP Status Code: $http_code"
  fi
}

create_payload() {
  CHART_LINK="https://github.com/rhdh-bot/openshift-helm-charts/tree/rhdh-$(echo "$RHDH_VERSION" | cut -d '.' -f 1,2)-rhel-9"
  HEADING="$RELEASE_STATE $RHDH_VERSION UPDATE"
  BUNDLE_IMAGE="quay.io/rhdh/rhdh-operator-bundle:$BUNDLE_TAG"
  FBC_LINK="https://quay.io/repository/rhdh/iib?tab=tags"

  # Create Slack payload in Block Kit format
  # See https://api.slack.com/reference/surfaces/formatting#mentioning-groups on how to mention groups and retrieve slack group IDs.
  # Currently the following groups/people are mentioned: rhdh-security(S07HB36PXN0), rhdh-qe(S06E0SM1W77), rhdh-docs-gate-keeper(S07LTQM5JGM), rhdh-release-manager(S08DAH1PCF6), lsharar(UMX6MAAH0)

  PAYLOAD=$(
    cat <<EOF
{
	"blocks": [
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": ":announcement: *${HEADING}*"
			}
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "*Images:*\`\`\` ${IMAGE_LIST} \`\`\`"
			}
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": ":link: *FBCs:*\n${FBC_LINK}"
			}
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": ":package: *Helm Chart Installation:*\n${CHART_LINK}"
			}
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "<!subteam^S07HB36PXN0> <!subteam^S06E0SM1W77> <!subteam^S07LTQM5JGM> <!subteam^S08DAH1PCF6> <@UMX6MAAH0>"
			}
		}
	]
}
EOF
  )

  echo "[INFO] PAYLOAD created"
}

get_images() {
  if [ -z "$BUNDLE_TAG" ]; then
    BUNDLE_IMAGE=$(${PWD}/getLatestImageTags.sh --quay --tag "$(echo "$RHDH_VERSION" | cut -d '.' -f 1,2)-" -c rhdh/rhdh-operator-bundle)
  else
    BUNDLE_IMAGE="quay.io/rhdh/rhdh-operator-bundle:$BUNDLE_TAG"
  fi

  ${PWD}/checkImagesInCSV.sh -q -y $BUNDLE_IMAGE -i 'hub|operator' >>"/tmp/imagelist_CSV_$RHDH_VERSION.txt"
  echo "$BUNDLE_IMAGE" >>"/tmp/imagelist_CSV_$RHDH_VERSION.txt"
  sort -uV "/tmp/imagelist_CSV_$RHDH_VERSION.txt" >"/tmp/imagelist_CSV_$RHDH_VERSION.txt_"
  mv "/tmp/imagelist_CSV_$RHDH_VERSION.txt"{_,}

  # Eg image: quay.io/rhdh/rhdh-operator-bundle:1.5-123
  skopeo inspect docker://$BUNDLE_IMAGE >/tmp/container_inspect.txt

  # GET MID_SHA
  MID_SHA=$(jq -r '.Labels."vcs-ref"' /tmp/container_inspect.txt)
  MID_SHA=${MID_SHA/sha256:/}

  # given a bundle and its SHA get the snapshot
  SNAPSHOT=$(oc -n rhdh-tenant get Snapshots --sort-by=.metadata.creationTimestamp \
    --selector="pac.test.appstudio.openshift.io/original-prname=rhdh-operator-bundle-$(echo "$RHDH_VERSION" | cut -d '.' -f 1,2 | tr '.' '-')-on-push,pac.test.appstudio.openshift.io/sha=${MID_SHA}" |
    sed -r -e '/NAME +AGE/d' -e "s/([a-z0-9-]+)\ +([0-9smhdy]+)/\1/g")

  rm -f /tmp/container_inspect.txt

  # get hub and operator images from the bundle snapshot
  oc -n 'rhdh-tenant' get Snapshot "$SNAPSHOT" -o yaml >/tmp/"$SNAPSHOT".yaml
  IMAGES=$(yq -r '.spec.components[].containerImage' /tmp/"$SNAPSHOT".yaml | sort -uV)
  IMAGE_LIST=""
  for i in $IMAGES; do
    imageAndTag="$(${PWD}/getTagForSHA.sh "$i" -q -y)"
    echo $imageAndTag >>"/tmp/imagelist_$SNAPSHOT.txt"
    i=$(echo $i | sed 's/^[^@]*\(@.*\)/\1/')
    IMAGE_LIST="$IMAGE_LIST$imageAndTag ($i)\n"
  done

  # Remove leading and trailing newlines
  IMAGE_LIST=$(echo -e "$IMAGE_LIST" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

  # Check if images in Snapshot matches with CSV referecnes in the bundle
  if [[ "$(cat "/tmp/imagelist_CSV_$RHDH_VERSION.txt")" != "$(cat "/tmp/imagelist_$SNAPSHOT.txt")" ]]; then
    echo "[ERROR] CSV images != images in snapshot:"
    echo "===================CSV========================"
    cat "/tmp/imagelist_CSV_$RHDH_VERSION.txt"
    echo "===================CSV========================"
    echo
    echo "===================snapshot==================="
    cat "/tmp/imagelist_$SNAPSHOT.txt"
    echo "===================snapshot==================="
    exit
  else
    echo "[INFO] Snapshot images match CSV images!"
    cat "/tmp/imagelist_$SNAPSHOT.txt"
  fi
  rm -f "/tmp/imagelist_$SNAPSHOT.txt" "/tmp/imagelist_CSV_$RHDH_VERSION.txt" "/tmp/"$SNAPSHOT".yaml"
}

# Main script logic to process input options
while [ $# -gt 0 ]; do
  case $1 in
  --release-state)
    RELEASE_STATE="$2"
    shift
    ;;
  --bundle-tag)
    BUNDLE_TAG="$2"
    shift
    ;;
  --version)
    RHDH_VERSION="$2"
    shift
    ;;
  --slack-webhook)
    WEBHOOK_URL="$2"
    shift
    ;;
  *)
    usage
    exit 1
    ;;
  esac
  shift
done

if [ -z "$RHDH_VERSION" ]; then
  echo "[ERROR] RHDH version is required."
  usage
  exit 1
fi

if [ -z "$WEBHOOK_URL" ]; then
  echo "[ERROR] Slack Webhook URL is required."
  usage
  exit 1
fi

get_images
create_payload
send_slack_message
