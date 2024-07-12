#!/bin/bash
#
# Copyright (c) 2023-2024 Red Hat, Inc.
#
# sync from upstream github to midstream gitlab
#
# requires yarn npm prettifier husky
# requires python3-pip npm git jq rsync
# requires yq (python wrapper for jq)
# requires make

# see also .gitlab-ci.yml and upstream_repos.yml

set -x
set -e

SCRIPT=$(readlink -f "$0")
ROOTPATH=$(dirname "$SCRIPT"); ROOTPATH=${ROOTPATH/\/build\/ci}
# THIS_REPO="rhpib/rhdh"
CLEAN=0     # clean up node_modules and anything from remote repo before creating local changes
FORCE=""    # force push to the midstream repo in case of merge conflicts
DO_BUILD=1  # fetch, transform, then build by default; use this to disable building
DO_COMMIT=1 # by default, commit change
DO_PUSH=1   # push the commit
GITLAB_PIPELINE="" # set "true" when running inside a gitlab pipeline to override default git push settings

TMPDIR=/tmp

# Ignore husky warnings
HUSKY=0; export HUSKY

# branding configuration
APPTITLE="Red Hat Developer Hub"
APPDESCRIPTION="A Red Hat supported version of Backstage, available as container image. Includes pre-built plug-ins, settings, and deployment details, to help streamline setting up a self-managed internal developer portal for new adopters"
FULL_LOGO="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDI3LjMuMSwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxvZ29zIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIKCSB2aWV3Qm94PSIwIDAgOTMxLjggMjQ0IiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCA5MzEuOCAyNDQ7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KCiAgICAgIDxwYXRoCiAgICAgICAgZmlsbD0iI2ZmZiIKICAgICAgICBkPSJNMjI4LjcgMjE5LjV2LTcyLjhoMjUuN2M1LjUgMCAxMC43LjkgMTUuNCAyLjggNC43IDEuOSA4LjggNC40IDEyLjIgNy43IDMuNCAzLjMgNiA3LjEgOCAxMS42IDEuOSA0LjUgMi45IDkuMyAyLjkgMTQuNHMtMSA5LjktMi45IDE0LjRjLTEuOSA0LjQtNC42IDguMy04IDExLjUtMy40IDMuMi03LjUgNS44LTEyLjIgNy42LTQuNyAxLjktOS44IDIuOC0xNS40IDIuOGgtMjUuN3ptMjUuOC02M2gtMTV2NTMuMmgxNWMzLjggMCA3LjQtLjcgMTAuNy0yIDMuMy0xLjQgNi4xLTMuMiA4LjUtNS42IDIuNC0yLjQgNC4zLTUuMiA1LjctOC40IDEuNC0zLjIgMi4xLTYuNyAyLjEtMTAuNXMtLjctNy4yLTIuMS0xMC41Yy0xLjQtMy4zLTMuMy02LjEtNS43LTguNS0yLjQtMi40LTUuMi00LjMtOC41LTUuNy0zLjMtMS4zLTYuOC0yLTEwLjctMnpNMzAwLjcgMTkzYzAtMy43LjctNy4zIDItMTAuNiAxLjQtMy4zIDMuMi02LjIgNS42LTguNyAyLjQtMi41IDUuMi00LjQgOC40LTUuOCAzLjItMS40IDYuNy0yLjEgMTAuNS0yLjEgMy42IDAgNyAuNyAxMC4xIDIuMSAzLjIgMS40IDUuOSAzLjQgOC4xIDUuOCAyLjMgMi41IDQgNS40IDUuNCA4LjggMS4zIDMuNCAyIDcgMiAxMC45djNIMzExYy43IDQuNCAyLjcgOCA2IDEwLjkgMy4zIDIuOSA3LjMgNC4zIDExLjkgNC4zIDIuNiAwIDUtLjQgNy40LTEuMiAyLjQtLjggNC40LTIgNi0zLjRsNi43IDYuNmMtMy4xIDIuNC02LjMgNC4yLTkuNiA1LjMtMy4zIDEuMS02LjkgMS43LTEwLjkgMS43LTMuOSAwLTcuNS0uNy0xMC45LTIuMS0zLjQtMS40LTYuMy0zLjMtOC44LTUuOC0yLjUtMi40LTQuNS01LjMtNS45LTguNy0xLjUtMy41LTIuMi03LjEtMi4yLTExem0yNi4zLTE4LjVjLTQgMC03LjUgMS4zLTEwLjQgNC0yLjkgMi42LTQuOCA2LTUuNSAxMC4yaDMxLjRjLS43LTQtMi41LTcuNC01LjQtMTAuMS0yLjktMi43LTYuMy00LjEtMTAuMS00LjF6TTM3Ny43IDIxOS41bC0yMi45LTUyLjloMTEuNGwxNi41IDM5LjYgMTYuNS0zOS42aDExLjFsLTIyLjkgNTIuOWgtOS43ek00MTIuNCAxOTNjMC0zLjcuNy03LjMgMi0xMC42IDEuNC0zLjMgMy4yLTYuMiA1LjYtOC43IDIuNC0yLjUgNS4yLTQuNCA4LjQtNS44IDMuMi0xLjQgNi43LTIuMSAxMC41LTIuMSAzLjYgMCA3IC43IDEwLjEgMi4xIDMuMiAxLjQgNS45IDMuNCA4LjEgNS44IDIuMyAyLjUgNCA1LjQgNS40IDguOCAxLjMgMy40IDIgNyAyIDEwLjl2M2gtNDEuOGMuNyA0LjQgMi43IDggNiAxMC45IDMuMyAyLjkgNy4zIDQuMyAxMS45IDQuMyAyLjYgMCA1LS40IDcuNC0xLjIgMi40LS44IDQuNC0yIDYtMy40bDYuNyA2LjZjLTMuMSAyLjQtNi4zIDQuMi05LjYgNS4zLTMuMyAxLjEtNi45IDEuNy0xMC45IDEuNy0zLjkgMC03LjUtLjctMTAuOS0yLjEtMy40LTEuNC02LjMtMy4zLTguOC01LjgtMi41LTIuNC00LjUtNS4zLTUuOS04LjctMS41LTMuNS0yLjItNy4xLTIuMi0xMXptMjYuMy0xOC41Yy00IDAtNy41IDEuMy0xMC40IDQtMi45IDIuNi00LjggNi01LjUgMTAuMmgzMS40Yy0uNy00LTIuNS03LjQtNS40LTEwLjEtMi45LTIuNy02LjMtNC4xLTEwLjEtNC4xek00ODQuNyAxNDQuNXY3NS4xaC0xMC40di03Mi44bDEwLjQtMi4zek00OTQuNSAxOTNjMC0zLjguNy03LjQgMi4xLTEwLjggMS40LTMuNCAzLjQtNi4zIDUuOS04LjcgMi41LTIuNSA1LjQtNC40IDguOC01LjggMy40LTEuNCA3LTIuMSAxMC44LTIuMSAzLjggMCA3LjQuNyAxMC44IDIuMSAzLjQgMS40IDYuMyAzLjQgOC43IDUuOCAyLjUgMi41IDQuNCA1LjQgNS44IDguNyAxLjQgMy40IDIuMSA3IDIuMSAxMC44IDAgMy45LS43IDcuNS0yLjEgMTAuOS0xLjQgMy40LTMuNCA2LjMtNS44IDguNy0yLjUgMi41LTUuNCA0LjQtOC43IDUuOC0zLjQgMS40LTcgMi4xLTEwLjggMi4xLTMuOCAwLTcuNC0uNy0xMC44LTIuMS0zLjQtMS40LTYuMy0zLjQtOC44LTUuOC0yLjUtMi41LTQuNS01LjQtNS45LTguNy0xLjQtMy40LTIuMS03LTIuMS0xMC45em00NC45IDBjMC01LjEtMS43LTkuNS01LjEtMTMtMy40LTMuNS03LjUtNS4zLTEyLjMtNS4zcy04LjkgMS44LTEyLjMgNS4zYy0zLjQgMy41LTUuMSA3LjktNS4xIDEzczEuNyA5LjUgNSAxMy4xYzMuNCAzLjYgNy41IDUuNCAxMi4zIDUuNCA0LjggMCA4LjktMS44IDEyLjMtNS40IDMuNS0zLjYgNS4yLTcuOSA1LjItMTMuMXpNNTU5LjMgMjQxLjF2LTc0LjVoMTAuM3Y1YzIuMi0xLjkgNC43LTMuMyA3LjUtNC4zczUuNy0xLjUgOC43LTEuNWMzLjcgMCA3LjIuNyAxMC41IDIuMSAzLjMgMS40IDYuMSAzLjQgOC41IDUuOCAyLjQgMi41IDQuMyA1LjQgNS43IDguNyAxLjQgMy4zIDIuMSA2LjkgMi4xIDEwLjYgMCAzLjgtLjcgNy40LTIuMSAxMC43LTEuNCAzLjMtMy4zIDYuMi01LjcgOC43LTIuNCAyLjUtNS4zIDQuNC04LjYgNS44LTMuMyAxLjQtNi45IDIuMS0xMC43IDIuMS0zIDAtNS44LS41LTguNS0xLjQtMi43LS45LTUuMS0yLjItNy4zLTMuOFYyNDFoLTEwLjR6bTI1LTY2LjNjLTMuMSAwLTUuOC42LTguMyAxLjctMi41IDEuMS00LjYgMi42LTYuMyA0LjZ2MjQuMWMxLjcgMS45IDMuOCAzLjQgNi4zIDQuNSAyLjYgMS4xIDUuMyAxLjcgOC4zIDEuNyA1LjEgMCA5LjQtMS44IDEyLjgtNS4zIDMuNC0zLjUgNS4xLTcuOCA1LjEtMTIuOSAwLTUuMi0xLjgtOS42LTUuMy0xMy4xLTMuMy0zLjUtNy42LTUuMy0xMi42LTUuM3pNNjIwIDE5M2MwLTMuNy43LTcuMyAyLTEwLjYgMS40LTMuMyAzLjItNi4yIDUuNi04LjcgMi40LTIuNSA1LjItNC40IDguNC01LjggMy4yLTEuNCA2LjctMi4xIDEwLjUtMi4xIDMuNiAwIDcgLjcgMTAuMSAyLjEgMy4yIDEuNCA1LjkgMy40IDguMSA1LjggMi4zIDIuNSA0IDUuNCA1LjQgOC44IDEuMyAzLjQgMiA3IDIgMTAuOXYzaC00MS44Yy43IDQuNCAyLjcgOCA2IDEwLjkgMy4zIDIuOSA3LjMgNC4zIDExLjkgNC4zIDIuNiAwIDUtLjQgNy40LTEuMiAyLjQtLjggNC40LTIgNi0zLjRsNi43IDYuNmMtMy4xIDIuNC02LjMgNC4yLTkuNiA1LjMtMy4zIDEuMS02LjkgMS43LTEwLjkgMS43LTMuOSAwLTcuNS0uNy0xMC45LTIuMS0zLjQtMS40LTYuMy0zLjMtOC44LTUuOC0yLjUtMi40LTQuNS01LjMtNS45LTguNy0xLjUtMy41LTIuMi03LjEtMi4yLTExem0yNi4zLTE4LjVjLTQgMC03LjUgMS4zLTEwLjQgNC0yLjkgMi42LTQuOCA2LTUuNSAxMC4yaDMxLjRjLS43LTQtMi41LTcuNC01LjQtMTAuMS0yLjktMi43LTYuMy00LjEtMTAuMS00LjF6TTY4MS45IDIxOS41di01Mi45aDEwLjR2Ni42YzEuNy0yLjYgMy45LTQuNiA2LjQtNS44IDIuNi0xLjIgNS4yLTEuOSA4LTEuOSAxLjIgMCAyLjIuMSAzLjEuMi45LjEgMS42LjMgMi4zLjZ2OS40Yy0uOC0uMy0xLjgtLjUtMi45LS44LTEuMS0uMi0yLjItLjQtMy4zLS40LTIuOCAwLTUuNC43LTcuOCAyLjItMi40IDEuNS00LjQgMy45LTUuOCA3LjN2MzUuNWgtMTAuNHpNNzQzLjcgMjE5LjV2LTcyLjhoMTAuOXYzMS4yaDM4Ljd2LTMxLjJoMTAuOXY3Mi44aC0xMC45di0zMS43aC0zOC43djMxLjdoLTEwLjl6TTgyOCAxNjYuNnYzMS41YzAgNC4xIDEuMiA3LjMgMy41IDkuOCAyLjQgMi40IDUuNiAzLjYgOS43IDMuNiAyLjggMCA1LjMtLjYgNy41LTEuOCAyLjItMS4yIDQuMS0yLjkgNS41LTUuMXYtMzguMWgxMC40djUyLjloLTEwLjR2LTUuM2MtMi4xIDIuMS00LjUgMy43LTcuMSA0LjctMi43IDEuMS01LjYgMS42LTguOCAxLjYtNiAwLTExLTEuOS0xNC44LTUuOC0zLjgtMy45LTUuOC04LjgtNS44LTE0Ljl2LTMzLjNIODI4ek05MjkuOSAxOTNjMCAzLjgtLjcgNy40LTIuMSAxMC43LTEuNCAzLjMtMy4zIDYuMi01LjcgOC43LTIuNCAyLjUtNS4zIDQuNC04LjYgNS44LTMuMyAxLjQtNi45IDIuMS0xMC43IDIuMS0zIDAtNS44LS41LTguNS0xLjRzLTUuMi0yLjItNy40LTR2NC41aC0xMC4zdi03Mi44bDEwLjQtMi4zdjI3YzIuMi0xLjkgNC43LTMuMyA3LjQtNC4zczUuNi0xLjUgOC43LTEuNWMzLjcgMCA3LjIuNyAxMC41IDIuMSAzLjMgMS40IDYuMSAzLjQgOC41IDUuOCAyLjQgMi41IDQuMyA1LjQgNS43IDguNyAxLjQgMy42IDIuMSA3LjIgMi4xIDEwLjl6bS0yOC4yLTE4LjJjLTMuMSAwLTUuOC42LTguMyAxLjctMi41IDEuMS00LjYgMi42LTYuMyA0LjZ2MjQuMWMxLjcgMS45IDMuOCAzLjQgNi4zIDQuNSAyLjYgMS4xIDUuMyAxLjcgOC4zIDEuNyA1LjEgMCA5LjQtMS44IDEyLjgtNS4zIDMuNC0zLjUgNS4xLTcuOCA1LjEtMTIuOSAwLTUuMi0xLjgtOS42LTUuMy0xMy4xLTMuMy0zLjUtNy42LTUuMy0xMi42LTUuM3oiCiAgICAgIC8+CiAgPGc+CiAgICAgICAgPHBhdGgKICAgICAgICAgIGQ9Ik0xMjkgODVjMTIuNSAwIDMwLjYtMi42IDMwLjYtMTcuNSAwLTEuMiAwLTIuMy0uMy0zLjRsLTcuNC0zMi40Yy0xLjctNy4xLTMuMi0xMC4zLTE1LjctMTYuNkMxMjYuNCAxMC4yIDEwNS4zIDIgOTkgMmMtNS44IDAtNy41IDcuNS0xNC40IDcuNS02LjcgMC0xMS42LTUuNi0xNy45LTUuNi02IDAtOS45IDQuMS0xMi45IDEyLjUgMCAwLTguNCAyMy43LTkuNSAyNy4yLS4zLjctLjMgMS40LS4zIDEuOUM0NCA1NC44IDgwLjMgODUgMTI5IDg1bTMyLjUtMTEuNGMxLjcgOC4yIDEuNyA5LjEgMS43IDEwLjEgMCAxNC0xNS43IDIxLjgtMzYuNCAyMS44LTQ2LjggMC04Ny43LTI3LjQtODcuNy00NS41IDAtMi44LjYtNS40IDEuNS03LjMtMTYuOC44LTM4LjYgMy44LTM4LjYgMjNDMiAxMDcuMiA3Ni42IDE0NiAxMzUuNyAxNDZjNDUuMyAwIDU2LjctMjAuNSA1Ni43LTM2LjYtLjEtMTIuOC0xMS0yNy4yLTMwLjktMzUuOCIKICAgICAgICAgIGZpbGw9IiNlMDAiCiAgICAgICAgLz4KICAgIDxwYXRoIGQ9Ik0xNjEuNSA3My42YzEuNyA4LjIgMS43IDkuMSAxLjcgMTAuMSAwIDE0LTE1LjcgMjEuOC0zNi40IDIxLjgtNDYuOCAwLTg3LjctMjcuNC04Ny43LTQ1LjUgMC0yLjguNi01LjQgMS41LTcuM2wzLjctOS4xYy0uMy43LS4zIDEuNC0uMyAxLjlDNDQgNTQuOCA4MC4zIDg1IDEyOSA4NWMxMi41IDAgMzAuNi0yLjYgMzAuNi0xNy41IDAtMS4yIDAtMi4zLS4zLTMuNGwyLjIgOS41eiIgLz4KICAgIDxwYXRoCiAgICAgIGZpbGw9IiNmZmYiCiAgICAgIGQ9Ik01ODEuMiA5NC4zYzAgMTEuOSA3LjIgMTcuNyAyMC4yIDE3LjcgMy4yIDAgOC42LS43IDExLjktMS43Vjk2LjVjLTIuOC44LTQuOSAxLjItNy43IDEuMi01LjQgMC03LjQtMS43LTcuNC02LjdWNjkuOGgxNS42VjU1LjZoLTE1LjZ2LTE4bC0xNyAzLjd2MTQuM0g1NzB2MTQuMmgxMS4zdjI0LjV6bS01Mi45LjNjMC0zLjcgMy43LTUuNSA5LjMtNS41IDMuNyAwIDcgLjUgMTAuMSAxLjN2Ny4yYy0zLjIgMS44LTYuOCAyLjYtMTAuNiAyLjYtNS41IDAtOC44LTIuMS04LjgtNS42bTUuMiAxNy42YzYgMCAxMC44LTEuMyAxNS40LTQuM3YzLjRoMTYuOFY3NS42YzAtMTMuNi05LjEtMjEtMjQuNC0yMS04LjUgMC0xNi45IDItMjYgNi4xbDYuMSAxMi41YzYuNS0yLjcgMTItNC40IDE2LjgtNC40IDcgMCAxMC42IDIuNyAxMC42IDguM3YyLjdjLTQtMS4xLTguMi0xLjYtMTIuNi0xLjYtMTQuMyAwLTIyLjkgNi0yMi45IDE2LjcgMCA5LjggNy44IDE3LjMgMjAuMiAxNy4zbS05Mi40LTFoMTguMVY4Mi40aDMwLjN2MjguOGgxOC4xVjM3LjZoLTE4LjF2MjguM2gtMzAuM1YzNy42aC0xOC4xdjczLjZ6bS02OS0yNy44YzAtOCA2LjMtMTQuMSAxNC42LTE0LjEgNC42IDAgOC44IDEuNiAxMS44IDQuM1Y5M2MtMyAyLjktNyA0LjQtMTEuOCA0LjQtOC4yLjEtMTQuNi02LTE0LjYtMTRtMjYuNiAyNy44aDE2LjhWMzMuOWwtMTcgMy43djIwLjljLTQuMi0yLjQtOS0zLjctMTQuMi0zLjctMTYuMiAwLTI4LjkgMTIuNS0yOC45IDI4LjVzMTIuNSAyOC42IDI4LjQgMjguNmM1LjUgMCAxMC42LTEuNyAxNC45LTQuOHY0LjF6bS03Ny4yLTQyLjdjNS40IDAgOS45IDMuNSAxMS43IDguOEgzMTBjMS43LTUuNSA1LjktOC44IDExLjUtOC44bS0yOC43IDE1YzAgMTYuMiAxMy4zIDI4LjggMzAuMyAyOC44IDkuNCAwIDE2LjItMi41IDIzLjItOC40bC0xMS4zLTEwYy0yLjYgMi43LTYuNSA0LjItMTEuMSA0LjItNi4zIDAtMTEuNS0zLjUtMTMuNy04LjhoMzkuNlY4NWMwLTE3LjctMTEuOS0zMC40LTI4LjEtMzAuNC0xNi4xLjEtMjguOSAxMi43LTI4LjkgMjguOW0tMjkuMy0zMC40YzYgMCA5LjQgMy44IDkuNCA4LjNzLTMuNCA4LjMtOS40IDguM2gtMTcuOVY1My4xaDE3Ljl6bS0zNiA1OC4xaDE4LjFWODQuNGgxMy44bDEzLjkgMjYuOGgyMC4ybC0xNi4yLTI5LjRjOC43LTMuOCAxMy45LTExLjcgMTMuOS0yMC43IDAtMTMuMy0xMC40LTIzLjUtMjYtMjMuNWgtMzcuN3Y3My42eiIKICAgIC8+CiAgICAgIDwvZz4KPC9zdmc+Cg=="
ICON_LOGO="data:image/svg+xml;base64,PHN2ZyBpZD0iTGF5ZXJfMSIgZGF0YS1uYW1lPSJMYXllciAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxOTIgMTQ1Ij48ZGVmcz48c3R5bGU+LmNscy0xe2ZpbGw6I2UwMDt9PC9zdHlsZT48L2RlZnM+PHRpdGxlPlJlZEhhdC1Mb2dvLUhhdC1Db2xvcjwvdGl0bGU+PHBhdGggZD0iTTE1Ny43Nyw2Mi42MWExNCwxNCwwLDAsMSwuMzEsMy40MmMwLDE0Ljg4LTE4LjEsMTcuNDYtMzAuNjEsMTcuNDZDNzguODMsODMuNDksNDIuNTMsNTMuMjYsNDIuNTMsNDRhNi40Myw2LjQzLDAsMCwxLC4yMi0xLjk0bC0zLjY2LDkuMDZhMTguNDUsMTguNDUsMCwwLDAtMS41MSw3LjMzYzAsMTguMTEsNDEsNDUuNDgsODcuNzQsNDUuNDgsMjAuNjksMCwzNi40My03Ljc2LDM2LjQzLTIxLjc3LDAtMS4wOCwwLTEuOTQtMS43My0xMC4xM1oiLz48cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik0xMjcuNDcsODMuNDljMTIuNTEsMCwzMC42MS0yLjU4LDMwLjYxLTE3LjQ2YTE0LDE0LDAsMCwwLS4zMS0zLjQybC03LjQ1LTMyLjM2Yy0xLjcyLTcuMTItMy4yMy0xMC4zNS0xNS43My0xNi42QzEyNC44OSw4LjY5LDEwMy43Ni41LDk3LjUxLjUsOTEuNjkuNSw5MCw4LDgzLjA2LDhjLTYuNjgsMC0xMS42NC01LjYtMTcuODktNS42LTYsMC05LjkxLDQuMDktMTIuOTMsMTIuNSwwLDAtOC40MSwyMy43Mi05LjQ5LDI3LjE2QTYuNDMsNi40MywwLDAsMCw0Mi41Myw0NGMwLDkuMjIsMzYuMywzOS40NSw4NC45NCwzOS40NU0xNjAsNzIuMDdjMS43Myw4LjE5LDEuNzMsOS4wNSwxLjczLDEwLjEzLDAsMTQtMTUuNzQsMjEuNzctMzYuNDMsMjEuNzdDNzguNTQsMTA0LDM3LjU4LDc2LjYsMzcuNTgsNTguNDlhMTguNDUsMTguNDUsMCwwLDEsMS41MS03LjMzQzIyLjI3LDUyLC41LDU1LC41LDc0LjIyYzAsMzEuNDgsNzQuNTksNzAuMjgsMTMzLjY1LDcwLjI4LDQ1LjI4LDAsNTYuNy0yMC40OCw1Ni43LTM2LjY1LDAtMTIuNzItMTEtMjcuMTYtMzAuODMtMzUuNzgiLz48L3N2Zz4="

# NAMESPACE="@redhat"
# tag/version in downstream repo to update
DWNSTM_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "rhdh-1-rhel-9")
if [[ ${DWNSTM_BRANCH} != "rhdh-"*"-rhel-"* ]]; then DWNSTM_BRANCH="rhdh-1-rhel-9"; fi

# upstream repos to fetch
UPSTREAM_FILE="${ROOTPATH}/upstream_repos.yml"

usage() {
  echo "
Usage:
* fetch & transform sources from upstream repos listed in $UPSTREAM_FILE
* transform Dockerfile to enable/disable osbs/cachito requirements
* transform app.title in app-config*.yaml to 'Red Hat Developer Hub'
* install deps, then build
* commit and push changes

Options:
    -a, --apptitle  APPTITLE  set new app.title in app-config*.yaml files; default: '$APPTITLE'
    -f                        yaml file listing repos, branches, and plugins to build. Default: '${UPSTREAM_FILE##*/}'
    --force                   remove contents of sync/ folder to force a build to happen, even if no changes in upstream
                              will also push changes to midstream repo with --force
    --clean                   cleanup midstream sources before fetching new files
    --nobuild                 after fetching and transforming, do not run 'yarn install' and 'yarn build'
    --nocommit                do not commit or push local changes
    --nopush                  do not push local changes
    --no                      alias for '--nobuild --nocommit --nopush'
    --gitlab-pipeline-push    use this flag to push changes when running inside a gitlab pipeline
    -b DWNSTM_BRANCH          downstream branch to update w/ latest SHA; default: '$DWNSTM_BRANCH'
    -y                        build and push to current branch, $(git branch --show-current), using all defaults

Examples:

    $0 --nobuild --nopush -b ${DWNSTM_BRANCH} -f ${UPSTREAM_FILE##*/}
    $0 -y
"
  exit 0
}

if [[ "$#" -lt 1 ]]; then usage; fi

while [[ "$#" -gt 0 ]]; do
  case $1 in
  '-f')
    UPSTREAM_FILE="$2"
    shift 2
    ;;
  '-b')
    DWNSTM_BRANCH="$2"
    shift 2
    ;;
  '-a' | '--apptitle')
    APPTITLE="$2"
    shift 2
    ;;
  '--force')
    FORCE="-f"
    #shellcheck disable=SC2044
    for d in $(find "${ROOTPATH}"/sync/ -type f); do echo "" > $d; done
    shift 1
    ;;
  '--clean')
    CLEAN=1;
    shift 1
    ;;
  '--nobuild')
    DO_BUILD=0
    shift 1
    ;;
  '--nocommit')
    DO_COMMIT=0
    DO_PUSH=0
    shift 1
    ;;
  '--nopush')
    DO_PUSH=0
    shift 1
    ;;
  '--no')
    DO_BUILD=0
    DO_COMMIT=0
    DO_PUSH=0
    shift 1
    ;;
  '-y')
    DWNSTM_BRANCH="$(git branch --show-current)"
    DO_BUILD=1
    DO_COMMIT=1
    DO_PUSH=1
    shift 1
    ;;
  '--gitlab-pipeline-push')
    DO_PUSH=0
    GITLAB_PIPELINE="true"
    shift 1
    ;;
  '-h' | '--help')
    usage
    ;;
  *)
    echo "[ERROR] Invalid parameter: $1"
    echo
    usage
    ;;
  esac
done

if [[ ! -f $UPSTREAM_FILE ]] || [[ ! $APPTITLE ]]; then usage; fi
# if [[ ! $NAMESPACE ]]; then usage; fi

if [[ $CI_BUILDS_DIR ]]; then # running in gitlab so set up env
  # shellcheck disable=SC1091
  source "${ROOTPATH}/build/ci/gitlab-ci-env-setup.sh"
fi

echo "#################################
Commandline switches:

CLEAN=$CLEAN
FORCE=$FORCE
DO_BUILD=$DO_BUILD
DO_COMMIT=$DO_COMMIT
DO_PUSH=$DO_PUSH
GITLAB_PIPELINE=$GITLAB_PIPELINE
#################################
"

set -e

createPr() {
  headBranch=$1
  baseBranch=$2
  git pull origin "${baseBranch}"
  git branch "${headBranch}" || true
  git checkout "${headBranch}"
  git merge "${baseBranch}"
  git push origin "${headBranch}" ${FORCE}
  # TODO replace with gitlab equivalent, maybe using API?
  if [[ $(/usr/bin/gh version 2>/dev/null || true) ]] || [[ $(which gh 2>/dev/null || true) ]]; then
    gh pr create -f -B "${baseBranch}" -H "${headBranch}" -w || true

  else
    echo "[WARN] gh cli is required to generate pull requests. See https://github.com/cli/cli?tab=readme-ov-file#installation to install it."
    echo -n "# To manually create a pull request, go here: "
    git config --get remote.origin.url | sed -r -e "s#:#/#" -e "s#git@#https://#" -e "s#\.git#/tree/${headBranch}/#"
  fi
}

# get all upstream branches to avoid merge conflicts
if [[ $GITLAB_PIPELINE == "true" ]]; then
  # NOTE that if debugging PRIVATE_TOKEN with set -x, token will be revealed in plaintext, not obfuscated
  git remote rm origin; git remote add origin "https://${CI_PROJECT_NAME}:${PRIVATE_TOKEN}@${CI_SERVER_HOST}/${CI_PROJECT_NAMESPACE}/${CI_PROJECT_NAME}.git"
  git remote set-branches origin "*" || true
  git fetch --all || true
  git checkout "${DWNSTM_BRANCH}" || true
  git pull origin "${DWNSTM_BRANCH}" || true
fi

# cleanup before fetching new files
if [[ $CLEAN -eq 1 ]]; then
  git checkout -- .
  git rm -rf --cached .
  git reset --hard HEAD
  git clean -fdx
fi
git config core.autocrlf input
git config --global merge.ff true
git config --global pull.ff-only true
git config --global pull.rebase true
git config --global branch.autosetupmerge true
git config --global branch.autosetuprebase always

git config --global advice.skippedCherryPicks false
git config --global advice.detachedHead false

# read "${UPSTREAM_FILE}" file; check out sources and include the required ones
NUM_REPOS=$(grep -v -E " +#" "${UPSTREAM_FILE}" | grep -c "repo:") # 2

# fp=0 # cound of fetched plugins from upstream
# cp=0 # count of converted/transformed plugins (midstreamed)

commitMsg=""
# num_plugins=0 # total number of plugins to fetch/build
destination_folders=""
mkdir -p sync/
NUM_SKIPS=0
BUNDLEDIR="" # absolute path distgit/containers/rhdh-operator-bundle/ folder
# shellcheck disable=SC2086,SC2295
for ((i = 0; i < NUM_REPOS; i++)); do # echo $i
  # plugins__=""
  # plugins_collapsed=""
  repo=$(yq --arg i "$i" -r '.repos['$i'].repo' "${UPSTREAM_FILE}")
  reponame=${repo##*/}
  repoorg=${repo%/${reponame}}
  repoorg=${repoorg##*/}
  branch0=$(yq --arg i "$i" -r '.repos['$i'].branch[0]' "${UPSTREAM_FILE}")
  branch1=$(yq --arg i "$i" -r '.repos['$i'].branch[1]' "${UPSTREAM_FILE}")
  if [[ $(git ls-remote --heads $repo refs/heads/$branch0 | wc -l) -eq 1 ]]; then
    branch=$branch0
  elif [[ $(git ls-remote --heads $repo refs/heads/$branch1 | wc -l) -eq 1 ]]; then
    branch=$branch1
  else
    echo "[ERROR] Could not find $branch0 or $branch1 at $repo !"; exit 1
  fi
  
  destination_folder=$(yq --arg i "$i" -r '.repos['$i'].destination_folder' "${UPSTREAM_FILE}")
  CONTAINER_NAME=${destination_folder#distgit/containers/}; CONTAINER_NAME=${CONTAINER_NAME%/}; # echo $CONTAINER_NAME # rhdh-hub or rhdh-operator
  destination_folders="${destination_folders} ${destination_folder}"
  rm -fr "$TMPDIR/repo${i}"
  echo
  echo "[INFO] Fetch $repo into $TMPDIR/repo${i} from branch $branch, then sync to $destination_folder ..."
  git clone $repo -b $branch "$TMPDIR/repo${i}" --depth=3 && \
  pushd "$TMPDIR/repo${i}" >/dev/null || exit 1
    # set -x
    branch="$(git branch --show-current)"
    SHA="$(git rev-parse --short=8 HEAD)"
    # cat "${ROOTPATH}/sync/upstream_SHA_${CONTAINER_NAME}"; echo "$SHA = $branch @ $repo"
    # if the current SHA file contains the current SHA/branch/repo combination, then there's nothing to sync! 
    if [[ -f "${ROOTPATH}/sync/upstream_SHA_${CONTAINER_NAME}" ]] && [[ $(cat "${ROOTPATH}/sync/upstream_SHA_${CONTAINER_NAME}") == *"$SHA = $branch @ $repo"* ]]; then
      if [[ ${CONTAINER_NAME} == "rhdh-hub" ]]; then 
        DO_BUILD=0
        echo "[INFO] Nothing changed in upstream repo: $SHA = $branch @ $repo; skip yarn build and sync!"
      else
        echo "[INFO] Nothing changed in upstream repo: $SHA = $branch @ $repo; skip sync!"
      fi
      (( NUM_SKIPS = NUM_SKIPS + 1 ))
      popd >/dev/null || exit 1
      rm -fr $TMPDIR/repo${i}
      continue
    fi

    if [[ -f .gitmodules ]]; then
      sed -i .gitmodules -r -e "s#(url = )git@github.com:#\1https://github.com/#"
      cat .gitmodules
      git submodule init
      git submodule update
      git submodule status
      # run whatever setup steps we need to do to bring things offline
      if [[ -f Makefile ]] && [[ $(grep -E "^init:$" Makefile) == "init:" ]]; then
        make init
      fi
      rm -f .gitmodules
    fi
    echo
    SHA="$(git rev-parse --short=8 HEAD)"

    echo "$SHA = $branch @ $repo" > "${ROOTPATH}/sync/upstream_SHA_${CONTAINER_NAME}"
    msg="${CONTAINER_NAME} from: $repo/tree/$branch @ $SHA"
    echo "[INFO] Update: $msg"
    commitMsg="${commitMsg} ${msg};"
    ##################################### rhdh-operator-bundle #####################################
    # if processing the upstream operator, also collect sync/upstream_SHA* file for operator-bundle
    if [[ $destination_folder == *"rhdh-operator"* ]]; then
      echo "$SHA = $branch @ $repo" > "${ROOTPATH}/sync/upstream_SHA_${CONTAINER_NAME}-bundle"
      msg="${CONTAINER_NAME}-bundle from: $repo/tree/$branch @ $SHA"
      echo "[INFO] Update: $msg"
      commitMsg="${commitMsg} ${msg};"
    fi
    ##################################### rhdh-operator-bundle #####################################
  popd >/dev/null || exit 1
  # set +x

  # remove checked out files
  # shellcheck disable=SC2086
  if [[ $(yq --arg i "$i" -r '.repos['$i'].include_root' "${UPSTREAM_FILE}") == "false" ]]; then
    rm -fr "$TMPDIR/repo${i}"
  else
    excludesList="$(yq --arg i "$i" -r '.repos['$i'].exclude_root[]' "${UPSTREAM_FILE}")"
    for ex in $excludesList; do
      excludesFlags="${excludesFlags} --exclude=${ex}"
    done
    echo -n "[INFO] [In $(pwd)] Sync upstream folder $TMPDIR/repo${i}/ to midstream ${destination_folder}... "
    pushd "$TMPDIR/" >/dev/null || exit 1
    set -x
    rsync -azq --delete $TMPDIR/repo${i}/* $TMPDIR/repo${i}/.??* "${ROOTPATH}/${destination_folder}/" --exclude=.git ${excludesFlags}
    set +x

    ##################################### rhdh-hub #####################################
    # if processing the upstream showcase/hub, also make some changes to the hub folder dowstream
    if [[ $destination_folder == *"rhdh-hub"* ]]; then
      rsync -azq $TMPDIR/repo${i}/.rhdh/docker/* "${ROOTPATH}/${destination_folder%/}/docker/" --exclude=.git ${excludesFlags}
    fi

    ##################################### rhdh-operator-bundle #####################################
    # if processing the upstream operator, also make some changes to the operator-bundle folder dowstream
    if [[ $destination_folder == *"rhdh-operator"* ]]; then
      echo -n " and ${destination_folder%/}-bundle ... "
      BUNDLEDIR="${ROOTPATH}/${destination_folder%/}-bundle"
      # copy the contents of bundle/ into distgit/containers/rhdh-operator-bundle/
      # NOTE: if we add any .dotfiles in bundle/, add $TMPDIR/repo${i}/bundle/.??* to regexes copied 
      rsync -azq --delete $TMPDIR/repo${i}/bundle/* $TMPDIR/repo${i}/.gitignore "${BUNDLEDIR}/" --exclude=.git ${excludesFlags}

      # downstream CSV and annotations are stored in https://github.com/janus-idp/operator/tree/main/.rhdh/bundle/
      # append overrides from the .rhdh/ tree: CSV and annotations
      rsync -azq $TMPDIR/repo${i}/.rhdh/bundle/* "${BUNDLEDIR}/" --exclude=.git ${excludesFlags}
      # and copy .rhdh/docker/bundle.Dockerfile to Dockerfile.in
      rsync -azq $TMPDIR/repo${i}/.rhdh/docker/bundle.Dockerfile "${BUNDLEDIR}/Dockerfile.in"

      # remove files we don't need downstream in operator-bundle/ or operator/bundle/
      for bundle_dir in "${BUNDLEDIR}" "${ROOTPATH}/${destination_folder%/}/bundle"; do 
        pushd "${bundle_dir}" >/dev/null || exit 1
          # shellcheck disable=SC2043
          for df in \
              manifests/backstage-operator.clusterserviceversion.yaml \
            ; do 
            git rm -fr $df 2>/dev/null || rm -f $df 2>/dev/null || true
          done

          # replace default backstage deployment name backstage-sample with developer-hub
          for yml in manifests/rhdh-operator.csv.yaml config/samples/_v1alpha1_backstage.yaml; do
            if [[ -f $yml ]]; then
              sed -i $yml -r -e "s/backstage-sample/developer-hub/g"
              if [[ $(git diff --name-only $yml) ]]; then # also update createdAt timestamp
                now=$(date -u +%FT%TZ) # "2023-12-18T16:11:34Z"
                echo "[INFO] Set createdAt: $now in $yml"
                sed -i $yml -r -e "s/createdAt: \"[0-9TZ:-]+\"/createdAt: \"${now}\"/g"
              fi
            fi
          done
        popd >/dev/null || exit 1
      done

      # use rhdh-operator.csv.yaml instead of backstage csv
      pushd "${BUNDLEDIR}" >/dev/null || exit 1
        git add . || true
      popd >/dev/null || exit 1
    fi
    ##################################### rhdh-operator-bundle #####################################

    popd >/dev/null || exit 1
    rm -fr "$TMPDIR/repo${i}"
    echo "done."
  fi

  echo "[INFO] Process files in ${destination_folder} ..."
  pushd "${destination_folder}" >/dev/null || exit 1

    ##################################### rhdh-hub #####################################
    # apply branding changes
    if [[ $destination_folder == *"rhdh-hub"* ]]; then
      # transform app.title in app-config*.yaml to "Red Hat Developer Hub"
      # adds RHDH theming and logos
      # shellcheck disable=SC2044,SC2016
      for d in $(find . -maxdepth 1 -name "app-config*.yaml"); do
        yq -Y -i --arg APPTITLE "$APPTITLE" -r '.app.title|=$APPTITLE' "$d"
        # Add RHDH Logos
        yq -Y -i --arg FULL_LOGO "$FULL_LOGO" -r '.app.branding.fullLogo|=$FULL_LOGO' "$d"
        yq -Y -i --arg ICON_LOGO "$ICON_LOGO" -r '.app.branding.iconLogo|=$ICON_LOGO' "$d"
      done

      # fix metadata in showcase.yaml
      d="catalog-entities/components/showcase.yaml"
      APPNAME="$(echo $APPTITLE | tr "A-Z " "a-z-")"
      yq -Y -i --arg APPNAME "$APPNAME" -r '.metadata.name|=$APPNAME' "$d"
      yq -Y -i --arg APPNAME "$APPNAME" -r '.spec.system|=$APPNAME' "$d"
      yq -Y -i --arg APPNAME "$APPNAME" -r '.spec.owner|="red-hat"' "$d"
      yq -Y -i --arg APPTITLE "$APPTITLE" -r '.metadata.title|=$APPTITLE' "$d"
      yq -Y -i --arg APPDESCRIPTION "$APPDESCRIPTION" -r '.metadata.description|=$APPDESCRIPTION' "$d"
      # remove links
      yq -Y -i -r '.metadata.links|=null' "$d"
      # insert new links from showcase.yaml_metadata.links.yaml
      sed -i -e "/links: null/{r ${ROOTPATH}/branding/catalog-entities/components/showcase.yaml_metadata.links.yaml" -e "d}" "$d"

      # set RHDH description in index.html
      d="packages/app/public/index.html"
      sed -i -r -e "s#(<meta name=\"description\" content=\")(.+)(\" />)#\1$APPTITLE\3#" "$d"

      # set build-metadata.json info, using upstream info: ${ROOTPATH}/sync/upstream_SHA_rhdh-hub ==> janus-idp/backstage-showcase main @ 2ff35695
      upstream_repo_and_SHA=$(sed -r -e "s|([0-9a-f]+) = (.+) @ .+/([^/]+/[^/]+)|\3 \2 @ \1|" "${ROOTPATH}/sync/upstream_SHA_rhdh-hub")
      sed -i packages/app/src/build-metadata.json -r \
        -e 's|("Last Commit:.+)|"Last Commit: '"$upstream_repo_and_SHA"'"|'
    fi
    ##################################### rhdh-hub #####################################

    # transform Dockerfile to Dockerfile.in; enable/disable osbs/cachito requirements
    # find the right file from one of several path options
    # NOTE: this transformation only works for hub and operator, not for .rhdh/docker/bundle.Dockerfile!
    DOCKERFILE_OPTIONS=".rhdh/docker/Dockerfile Dockerfile"
    for d in $DOCKERFILE_OPTIONS; do
      if [[ -f $d ]]; then
        echo "[INFO] Convert $d to Dockerfile.in ..."
        DOCKERFILE="$d"
        awk '
/# Downstream comment/{
  found_comment=1 # start a commenting block
  print $0
  next
}
/# Downstream uncomment/{
  found_uncomment=1 # start a commenting block
  print $0
  next
}
/#\/ Downstream comment/{
  found_comment=0 # end a commenting block
  print $0
  next
}
/#\/ Downstream uncomment/{
  found_uncomment=0 # end a commenting block
  print $0
  next
}
/.*/ {
  if (!found_comment && !found_uncomment) {
    print $0 # print the line as is
  }
  if(found_uncomment){ # uncomment the line
    print gensub(/^# (.+)/,"\\1", "g")
  }
  if(found_comment){ # comment the line
    print "# "gensub(/^# (.+)/,"\\1", "g")
  }
}
' $DOCKERFILE > Dockerfile.in
        rm -f $DOCKERFILE
        break
      fi
    done

    # TODO can we just remove this and use the same reg.access.rh.com or reg.rh.io repos downstream?
    # transform Dockerfile.in for use in Brew
    sed -i Dockerfile.in -r \
      `# Remove registry for Brew` \
      -e "s#FROM (registry.access.redhat.com|registry.redhat.io)/#FROM #g" \
      `# Use registry-proxy.engineering.redhat.com/rh-osbs/rhel9-go-toolset for Brew` \
      -e "s#FROM(.+)ubi9/go-toolset#FROM\1rhel9/go-toolset#g" \
      `# Remove unnecessary intermediate named stages (which Brew doesn't like); rename initial stage from skeleton to builder`
    # -e "/FROM (skeleton|deps|cleanup) AS .+/d" -e "s/--from=build //" -e "s/--from=cleanup/--from=builder/" -e "s/AS skeleton/AS builder/"

  popd >/dev/null || exit 1 # distgit/containers/*
done                        # foreach upstream repo

if [[ "$NUM_SKIPS" == "$NUM_REPOS" ]]; then 
  echo " 
=================================================================
[SKIP] Nothing to sync or build: $NUM_SKIPS of $NUM_REPOS upstream repos unchanged!
=================================================================
" | tee /tmp/sync-midstream.sh.result.txt
  ./build/ci/cancel-pipeline.sh
  exit 0
fi

# append Brew metadata here
sed -i '/# append Brew metadata here/q' distgit/containers/rhdh-hub/Dockerfile.in
cat <<EOT >>distgit/containers/rhdh-hub/Dockerfile.in
ENV SUMMARY="Red Hat Developer Hub container" \\
    DESCRIPTION="Red Hat Developer Hub container" \\
    PRODNAME="rhdh" \\
    COMPNAME="hub"

LABEL summary="\$SUMMARY" \\
      description="\$DESCRIPTION" \\
      io.k8s.description="\$DESCRIPTION" \\
      io.k8s.display-name="\$DESCRIPTION" \\
      io.openshift.tags="\$PRODNAME,\$COMPNAME" \\
      com.redhat.component="\$PRODNAME-\$COMPNAME-container" \\
      name="\$PRODNAME/\$PRODNAME-\$COMPNAME-rhel9" \\
      version="\${CI_X_VERSION}.\${CI_Y_VERSION}" \\
      license="ASLv2" \\
      maintainer="RHDH Team <rhdh-bot@redhat.com>" \\
      io.openshift.expose-services="" \\
      usage=""
EOT
echo "[INFO] Added metadata to distgit/containers/rhdh-hub/Dockerfile.in"
mkdir -p distgit/containers/rhdh-hub/.git/
cat <<EOT >distgit/containers/rhdh-hub/.git/config
[core]
  repositoryformatversion = 0
  filemode = true
  bare = false
  logallrefupdates = true
  hooksPath = .husky
  autocrlf = input
EOT
echo "[INFO] Generated distgit/containers/rhdh-hub/.git/config for use with Husky"

# append Brew metadata here
sed -i '/# append Brew metadata here/q' distgit/containers/rhdh-operator/Dockerfile.in
cat <<EOT >>distgit/containers/rhdh-operator/Dockerfile.in
ENV SUMMARY="Red Hat Developer Hub operator" \\
    DESCRIPTION="Red Hat Developer Hub operator" \\
    PRODNAME="rhdh" \\
    COMPNAME="operator"

LABEL summary="\$SUMMARY" \\
      description="\$DESCRIPTION" \\
      io.k8s.description="\$DESCRIPTION" \\
      io.k8s.display-name="\$DESCRIPTION" \\
      io.openshift.tags="\$PRODNAME,\$COMPNAME" \\
      com.redhat.component="\$PRODNAME-\$COMPNAME-container" \\
      name="\$PRODNAME/\$PRODNAME-rhel9-\$COMPNAME" \\
      version="\${CI_X_VERSION}.\${CI_Y_VERSION}" \\
      license="ASLv2" \\
      maintainer="RHDH Team <rhdh-bot@redhat.com>" \\
      io.openshift.expose-services="" \\
      usage=""
EOT
echo "[INFO] Added metadata to distgit/containers/rhdh-operator/Dockerfile.in"

# append Brew metadata here
sed -i '/# append Brew metadata here/q' distgit/containers/rhdh-operator-bundle/Dockerfile.in
cat <<EOT >>distgit/containers/rhdh-operator-bundle/Dockerfile.in
ENV SUMMARY="Red Hat Developer Hub operator bundle" \\
    DESCRIPTION="Red Hat Developer Hub operator bundle" \\
    PRODNAME="rhdh" \\
    COMPNAME="operator-bundle"

LABEL operators.operatorframework.io.bundle.mediatype.v1=registry+v1 \\
      operators.operatorframework.io.bundle.manifests.v1=manifests/ \\
      operators.operatorframework.io.bundle.metadata.v1=metadata/ \\
      operators.operatorframework.io.bundle.package.v1=rhdh \\
      operators.operatorframework.io.bundle.channels.v1=fast,fast-\${CI_X_VERSION}.\${CI_Y_VERSION} \\
      operators.operatorframework.io.bundle.channel.default.v1=fast \\
      com.redhat.delivery.operator.bundle="true" \\
      com.redhat.openshift.versions="v4.12" \\
      com.redhat.delivery.backport=false \\
      summary="\$SUMMARY" \\
      description="\$DESCRIPTION" \\
      io.k8s.description="\$DESCRIPTION" \\
      io.k8s.display-name="\$DESCRIPTION" \\
      io.openshift.tags="\$PRODNAME,\$COMPNAME" \\
      com.redhat.component="\$PRODNAME-\$COMPNAME-container" \\
      name="\$PRODNAME/\$PRODNAME-\$COMPNAME" \\
      version="\${CI_X_VERSION}.\${CI_Y_VERSION}" \\
      license="ASLv2" \\
      maintainer="RHDH Team <rhdh-bot@redhat.com>" \\
      io.openshift.expose-services="" \\
      usage=""
EOT
echo "[INFO] Added metadata to distgit/containers/rhdh-operator-bundle/Dockerfile.in"

# build the plugins
if [[ $DO_BUILD -eq 1 ]]; then
  destination_folder="distgit/containers/rhdh-hub"
  pushd $destination_folder >/dev/null || exit 1
    echo "
 
=================================================================
[INFO] Build $(pwd) ...
=================================================================
 
"
    echo
    #shellcheck disable=SC2044
    YARN=$(which yarn)
    export YARN
    $YARN config set "strict-ssl" false -s
    $YARN config set unsafe-perm true
    $YARN config set network-timeout 600000
    $YARN config list --verbose
    echo -n "Yarn version ($YARN): "
    $YARN --version
    echo

    echo "[INFO] ===================================== INSTALL =====================================>"
    time $YARN install --silent 2> >(grep -v warning 1>&2) || exit 10
    # if we need node-gyp to be globally installed in gitlab runner, re can re-enable this
    # if [[ $(id -u) -eq 0 ]]; then
    #   time npm i -g node-gyp@^9.4.1 turbo prettier
    # fi
    # for d in node-gyp turbo prettier; do echo -n "$d : "; $d --version; done;
    echo "[INFO] <===================================== INSTALL ====================================="
    echo

    echo "[INFO] ===================================== EXPORT + COPY DYNAMIC PLUGINS =====================================>"
    # see (brew.)Dockerfile for more details about these steps
    echo -n "Yarn version ($YARN): "
    $YARN --version
    time $YARN export-dynamic 2> >(grep -v warning 1>&2) || exit 41
    time $YARN copy-dynamic-plugins dist 2> >(grep -v warning 1>&2) || exit 42
    echo "[INFO] <===================================== EXPORT + COPY DYNAMIC PLUGINS ====================================="
    echo

    echo "[INFO] ===================================== Collect dynamic-plugins/imports/package.json#.peerDependencies =====================================>"
    # generate new package.json for the peer deps in dynamic-plugins/imports, so that we can cache them in cacito registry
    d=dynamic-plugins-imports-peer-dependencies
    mkdir -p "$d"
    cat << EOF > "$d"/package.json
{
  "name": "dynamic-plugins-imports-peer-dependencies",
  "version": "0.0.0",
  "private": true,
  "engines": {
    "node": "18 || 20"
  },
  "packageManager": "yarn@1.22.19",
  "dependencies": {}
}
EOF
    # copy dynamic-plugins/imports/package.json#.peerDependencies to $d/package.json#.dependencies
    peerDepPairs="$(jq -M -c '.peerDependencies' dynamic-plugins/imports/package.json | tr -d "{}")"
    jq '.dependencies|={'"$peerDepPairs"'}' "$d"/package.json > "$d"/package.json_; mv "$d"/package.json{_,}
    $YARN install --silent --cwd "./$d" 2> >(grep -v warning 1>&2) || exit 51

    pushd dynamic-plugins/imports >/dev/null || exit
      cp -f --parents ./*/dist-dynamic/package.json ./*/dist-dynamic/yarn.lock ../../"$d"/
    popd >/dev/null || exit
    peerDepPairs=$(echo "$peerDepPairs" | tr "," "\n")

    echo "[INFO] Got these peer dependencies:
-----
${peerDepPairs}
-----
"
    echo "[INFO] <===================================== Collect dynamic-plugins/imports/package.json#.peerDependencies  ====================================="

    echo "[INFO] ===================================== Regen container.yaml.in =====================================>"
    # list paths to yarn.lock files to tell Cachito how to fetch all the dependencies into a local yarn registry.
    c=0
    # clear old paths
    yq -Yy '.remote_sources[0].remote_source.packages.yarn|=null' container.yaml.in > container.yaml.in_; mv container.yaml.in_ container.yaml.in
    for yarnlock in $(find . -name "yarn.lock" | grep -E -v "node_modules/|dynamic-plugins/imports/" | sort -r); do
      dir="${destination_folder}/${yarnlock#./}"; dir=${dir%/yarn.lock}
      if [[ $dir != *"/dynamic-plugins/dist/"* ]]; then
        echo "[INFO] Add path[$c] to container.yaml.in: $dir"
        yq -Yy '.remote_sources[0].remote_source.packages.yarn['"$c"']|={"path":"'"$dir"'"}' container.yaml.in > container.yaml.in_; mv container.yaml.in_ container.yaml.in
        (( c = c + 1 ))
      # else
      #   echo "[INFO] Skip $dir"
      fi
    done
    echo "[INFO] <===================================== Regen container.yaml.in ====================================="
    echo
  popd >/dev/null || exit 1

  echo "[INFO] ====================== Remove node_modules and other generated / gitignored content =====================>"
  set +e
  # shellcheck disable=SC2086
  for ignored in \
    node_modules \
    .DS_Store \
    logs \
    *.log *debug.log* *error.log* \
    coverage \
    .env .env.test \
    dist-types dist-scalprum \
    cache \
    *.swp site *.local.yaml \
    .rhdh \
    *.session.sql .turbo; do
      find distgit/containers/rhdh-*/ -name "${ignored}" -exec rm -fr {} \; 2>/dev/null
  done
  # shellcheck disable=SC2043
  for ignored in \
    dist; do
      find distgit/containers/rhdh-*/packages/ -name "${ignored}" -exec rm -fr {} \; 2>/dev/null
  done
  # same package.json+yarn.lock present in dynamic-plugins/wrappers/ so we don't need dynamic-plugins/dist/ too
  rm -fr \
    distgit/containers/rhdh-hub/dynamic-plugins-root/* \
    distgit/containers/rhdh-hub/dynamic-plugins/dist/ \
    distgit/containers/rhdh-hub/dynamic-plugins/wrappers/*/dist-dynamic/src \
    distgit/containers/rhdh-hub/dynamic-plugins/imports/*/ \
    distgit/containers/rhdh-hub/dynamic-plugins/*/dist-dynamic/src
  touch distgit/containers/rhdh-hub/dynamic-plugins-root/.gitkeep

  echo "[INFO] <===================== Remove node_modules and other generated / gitignored content ====================="
  echo
  set -e

  echo "[INFO] ===================================== Patch embedded yarn commands =====================================>"
  # fix dynamic-plugins/imports/import-plugins.js to use more flags; fix package.json to use specific $YARN

  echo "[INFO] Patch yarn commmand in dynamic-plugins/imports/import-plugins.js ..."
  sed -i distgit/containers/rhdh-hub/dynamic-plugins/imports/import-plugins.js \
  -e "s#yarn install#\$YARN install --network-timeout 600000#g"

  # backstage-plugin-kubernetes-backend:export-dynamic: error Your lockfile needs to be updated, but yarn was run with `--frozen-lockfile`.
  # don't use --frozen-lockfile to see if that makes Cachito happy
  insertYarn=" --no-install \&\& \$YARN --cwd dist-dynamic install --production --network-timeout 600000"
  #shellcheck disable=SC2044,SC2143

  # two options for janus-cli syntax (--in-place added June 2024):
  # janus-cli package export-dynamic-plugin --in-place # front end - do NOT convert
  # janus-cli package export-dynamic-plugin --embed-package @backstage/plugin-scaffolder-backend-module-bitbucket-cloud --override-interop default --no-embed-as-dependencies # back end - DO convert
  for d in $(find distgit/containers/rhdh-hub/dynamic-plugins -name package.json) ; do
    # determine if this a front or back end plugin; only work on BACK END plugins
    # see https://github.com/redhat-developer/rhdh-plugin-export-utils/blob/main/export-dynamic/export-dynamic.sh
    if [[ "$(grep -e '"role" *: *"backend-plugin' package.json)" != "" ]] && [[ $(grep -E 'export-dynamic-plugin' "$d" | grep -v -- '--network-timeout') ]]; then
      echo "[INFO] Patch yarn command in ${d#distgit/containers/rhdh-hub/} (back end plugins ONLY) ..."
      sed -i "$d" -r \
      -e 's#("janus-cli package export-dynamic-plugin.+)"#\1'"$insertYarn"'"#g'
      # debug
      grep -E "network-timeout|export-dynamic-plugin" "$d" || true
    fi
  done
  echo "[INFO] <===================================== Patch embedded yarn commands ====================================="
  echo

  # debug
  # find distgit/containers/rhdh-*/ -name "dist" -exec tree -d {} \; 2>/dev/null
  # find distgit/containers/rhdh-*/ -name "dist-dynamic" -exec tree -d {} \; 2>/dev/null

  echo "[INFO] ===================================== Configure cachito =====================================>"
  # verify folders exist and are configured correctly for cachito to use
  haderror=0
  for d in $(yq -r -Y '.remote_sources[0].remote_source.packages.yarn' distgit/containers/rhdh-hub/container.yaml.in | sed -r "s#- path: ##"); do
    if [[ ! -d $d ]] || [[ ! -f $d/package.json ]] || [[ ! -f $d/yarn.lock ]]; then
      echo "[ERROR] Problem with folder $d -- check if package.json or yarn.lock are present!"
      (( haderror = haderror + 1 ))
    else
      # shellcheck disable=SC2086,SC2013
      if [[ $d == *"/dist-dynamic"* ]]; then
        echo "[INFO] Replace resolutions with dependencies in ${d##*wrappers/}/package.json ..."
        if [[ $(find "$d" -name package-lock.json) ]]; then
          echo "[ERROR] Found package-lock.json in $d! Must abort!"; exit 20
        fi

        # 0. collect existing .dependencies
        pairs="$(jq -M -c '.dependencies' "$d"/package.json | tr -d "{}")"; if [[ "$pairs" ]]; then pairs=",$pairs"; fi

        # 1. add resolutions to dependencies
        # "npm:@smithy/util-utf8@^2.0.0" --> "@smithy/util-utf8": "^2.0.0"
        for key in $(jq '.resolutions|to_entries[].key' "$d"/package.json); do
          val=$(jq '.resolutions['$key']' "$d"/package.json)
          val_clean=${val/npm:/}; val_clean=${val_clean//\"/}; # echo $val_clean
          # split on @
          depName=${val_clean%@*};
          depVer=${val_clean##*@};
          # echo "   $depName: $depVer"
          pairs="$pairs,\"$depName\": \"$depVer\""
        done
        # "@aws-sdk/util-utf8-browser" -> "@aws-sdk/util-utf8-browser": "^3"
        pairs="$pairs,\"@aws-sdk/util-utf8-browser\": \"^3\""
        pairs=${pairs:1} # trim prefix comma

        # echo "[INFO] Insert dependencies = $pairs ..."
        jq '.dependencies|={'"$pairs"'}' "$d"/package.json > "$d"/package.json_; mv "$d"/package.json{_,}

        # 2. remove resolutions (moved above)
        jq '.resolutions|={}' "$d"/package.json > "$d"/package.json_; mv "$d"/package.json{_,}

        # 3. fix version 1.4.3 in dynamic-plugins-imports-peer-dependencies/janus-idp-backstage-plugin-aap-backend/dist-dynamic/package.json 
        #    if matching peer dep exists @janus-idp/backstage-plugin-aap-backend:1.4.4
        oldPeerDepVer="$(jq -r '.version' "$d"/package.json)"
        # echo "[DEBUG] Checking $d/package.json for old version $oldPeerDepVer to update..."
        for peerDep in $peerDepPairs; do
          peerDep=$(echo $peerDep | tr -d "@\"" | tr "/" "-")
          peerDepName=${peerDep%%:*}
          peerDepVer=${peerDep##*:}
          # echo "[INFO] Found $peerDepName @ $peerDepVer"
          if [[ "${d}" == *"${peerDepName}/dist-dynamic"* ]] && [[ "$oldPeerDepVer" != "$peerDepVer" ]]; then
            echo "[INFO] Bump to version $peerDepVer ..."
            jq --arg peerDepVer $peerDepVer '.version|=$peerDepVer' "$d"/package.json > "$d"/package.json_; mv "$d"/package.json{_,}
          fi
        done

        echo "[INFO] Regenerate ${d##*wrappers/}/yarn.lock ..."
        $YARN install --silent --cwd "./$d" 2> >(grep -v warning 1>&2) || exit 61
        # force add package.json and yarn.lock (override .gitignore)
        git add -f "$d"/package.json "$d"/yarn.lock
      fi
    fi
  done # hub container

  # switch from yarn to npm registry, in case this makes Cachito happier?
  # Could not download types-jest-29.5.7.tgz from https://cachito-nexus.engineering.redhat.com/repository/cachito-yarn-1047885/@types/jest/-/jest-29.5.7.tgz
  # shellcheck disable=SC2044
  for d in $(find distgit/containers/rhdh-hub/ -name yarn.lock); do sed -i "$d" -r -e "s#registry.yarnpkg.com#registry.npmjs.org#g"; done

  # shellcheck disable=SC2086
  if [[ $haderror -gt 0 ]]; then echo "[ERROR] Had $haderror problems; must exit."; exit $haderror; fi
  echo "[INFO] <===================================== Configure cachito ====================================="
  echo

  echo "[INFO] ===================================== Apply branding to distgit/ folders =====================================>"
  # shellcheck disable=SC2044
  for d in $(find "${ROOTPATH}/branding/distgit" -type f); do
    echo "[INFO] Update ${d##*branding/}"
    cp -f "$d" "${d/branding\/}"
  done
  echo "[INFO] <===================================== Apply branding to distgit/ folders ====================================="
  echo
fi ## if DO_BUILD

# compute x.y version from package.json
DH_VERSION=$(yq -r '.version' distgit/containers/rhdh-hub/package.json) # 1.2.0
DH_VERSION=${DH_VERSION%.*} # 1.2
echo "[INFO] Got DH_VERSION = $DH_VERSION from distgit/containers/rhdh-hub/package.json#.version"

for d in distgit/containers/rhdh-hub distgit/containers/rhdh-operator distgit/containers/rhdh-operator-bundle; do
  echo "[INFO] Remove generated/ignored content; regen Dockerfiles from Dockerfile.in [$d] ..."
  pushd "$d" >/dev/null || exit 1
    set +e
    # shellcheck disable=SC2086
    for ignored in \
      node_modules \
      *.pack *.pack.old .webpack-cache \
      .DS_Store \
      logs \
      *.log *debug.log* *error.log* \
      coverage \
      .env .env.test \
      dist-types \
      cache \
      *.swp site *.local.yaml \
      .rhdh \
      *.session.sql .turbo; do
        find . -name "${ignored}" -exec rm -fr {} \; 2>/dev/null
    done
    set -e
    # generate Dockerfile from Dockerfile.in
    sed -r -e 's|\$\{CI_X_VERSION\}\.\$\{CI_Y_VERSION\}|'"$DH_VERSION"'|' Dockerfile.in > Dockerfile

    ##################################### rhdh-operator-bundle #####################################
    # generate annotations from upstream file in .rhdh/bundle/metadata/annotations.yaml
    if [[ $d == "distgit/containers/rhdh-operator-bundle" ]] && [[ -f metadata/annotations.yaml ]]; then 
      sed -r -e 's|\$\{CI_X_VERSION\}\.\$\{CI_Y_VERSION\}|'"$DH_VERSION"'|' -i metadata/annotations.yaml
    fi
    ##################################### rhdh-operator-bundle #####################################
  popd >/dev/null || exit 1
done

# revert any local changes to the hub so we don't accidentally push in changes from upstream without first running a yarn build
if [[ $DO_BUILD -eq 0 ]]; then
  git restore --staged distgit/containers/rhdh-hub; git restore distgit/containers/rhdh-hub
fi

echo
if [[ $(git status -s || true) ]]; then
  echo "################# DIFF #############################>"
  echo "[INFO] Commit changes in $(pwd):"
  git status -s || true
  echo "<################# DIFF #############################"
else
  echo "[INFO] No new changes to commit in $(pwd)! "
fi
echo

################################# COMMIT CHANGES #################################

if [[ $DO_COMMIT -eq 1 ]]; then
  echo "[INFO] Committing changes to $destination_folders dirs and sync/upstream_SHA* files ..."
  gitdiff="$(git diff --name-only || true)"
  # shellcheck disable=SC2086
  git add -f ${destination_folders} sync/upstream_SHA* || true
  if [[ $gitdiff ]]; then
    echo "
==============================================================
[INFO] Midstream diff:

$gitdiff

==============================================================
"
echo "$gitdiff" > "/tmp/sync-midstream.sh.diff.txt"
  else
    echo " 
==============================================================
[SKIP] Nothing to sync: midstream diff is empty!
==============================================================
" | tee /tmp/sync-midstream.sh.result.txt
    ./build/ci/cancel-pipeline.sh
  fi

  #################################################################
  # first commit: update any changed files, plus sync/upstream_SHA*
  #################################################################

  git commit -s -m "chore: Update:${commitMsg} [skip ci]" . || true

  # get the current commit SHA and put it into upstream_sources.yml + container.yaml
  newSHA=$(git rev-parse HEAD)

  # TODO if we remove CPaaS entirely, we can remove this file
  # shellcheck disable=SC2016
  yq -yY -i --arg newSHA "$newSHA" -r '.git[0].commit|=$newSHA' upstream_sources.yml
  # remove spaces so this change looks like the ones CPaaS generates
  sed -i upstream_sources.yml -r -e "s/^  //"

  # update generated content for downstream, because you can't trust CPaaS
  UPSTREAM_COMMIT=$newSHA
  UPSTREAM_REPO="https://gitlab.cee.redhat.com/rhidp/rhdh.git"

  ########################################################################################################
  # second commit: update upstream_sources.yml
  # second commit: update container.yamls ONLY if the associated sync/upstream_SHA* file was changed above
  # TODO if we remove CPaaS entirely, we can write directly to container.yaml and remove container.yaml.in
  ########################################################################################################

  containerYamls=""
  for d in rhdh-hub rhdh-operator; do
    if [[ $(git diff --name-only HEAD~1 sync/upstream_SHA_${d} || true) ]]; then containerYamls="${containerYamls} distgit/containers/${d}"; fi
  done
  echo "[INFO] Regen container.yaml from container.yaml.in files for: [$containerYamls ]"
  # shellcheck disable=SC2016
  for d in $containerYamls; do
    pushd "$d" >/dev/null || exit 1
      echo "[INFO] Using UPSTREAM_COMMIT = $UPSTREAM_COMMIT"
      sed -r -e "/ +yarn: null/d" -i container.yaml.in
      sed -r \
        -e 's|repo: \$\{CI_RHDH_UPSTREAM_URL\}|repo: '"$UPSTREAM_REPO"'|' \
        -e 's|ref: \$\{CI_RHDH_UPSTREAM_COMMIT\}|ref: '"$UPSTREAM_COMMIT"'|' container.yaml.in > container.yaml && git add container.yaml*
      echo "[INFO] Generated $d/container.yaml from .in file (CPaaS bypass)"
    popd >/dev/null || exit 1
  done

  # commit it all
  git commit -s -m "chore: Update:${commitMsg} upstream_sources.yml to $newSHA" . || true
fi ## if DO_COMMIT

################################# PUSH CHANGES #################################

# if pushing as a normal user
if [[ ${DO_PUSH} -eq 1 ]]; then
  BRANCHUSED="${DWNSTM_BRANCH}"
  PR_BRANCH="pr-update-sync-rhdh-hub-$(date +%s)"

  git pull origin "${BRANCHUSED}"
  set -x
  PUSH_TRY="$(git push origin "${BRANCHUSED}" ${FORCE} 2>&1 || true)"
  # shellcheck disable=SC2181
  if [[ $? -gt 0 ]] || [[ $PUSH_TRY == *"protected branch hook declined"* ]]; then
    # create pull request if target branch is restricted access
    createPr "${PR_BRANCH}" "${BRANCHUSED}"
  fi
  set +x
fi ## if DO_PUSH

# if pushing as a gitlab pipeline
if [[ $GITLAB_PIPELINE == "true" ]]; then
  # push changes; see also https://docs.gitlab.com/ee/ci/variables/predefined_variables.html
  echo "Pushing changes as $GITLAB_USER_LOGIN ($GITLAB_USER_EMAIL) to branch $CI_COMMIT_REF_NAME of ${CI_SERVER_HOST}/${CI_PROJECT_NAMESPACE}/${CI_PROJECT_NAME} ..."
  set -x
  git pull origin "HEAD:$CI_COMMIT_REF_NAME" || true
  git push origin "HEAD:$CI_COMMIT_REF_NAME" -o ci.skip ${FORCE} || exit 16
  set +x
fi
