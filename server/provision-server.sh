#!/bin/bash
# provision-server.sh — Start SpawnKit Provision Backend (port 3456)
cd "$(dirname "$0")"
PROVISION_TOKEN="${PROVISION_TOKEN:-sk-provision-dev}" \
PROVISION_PORT="${PROVISION_PORT:-3456}" \
node provision-server.js
