#!/bin/bash
# Trigger a Render deploy of the current master (auto-deploy webhook isn't wired
# for this API-created service, so we deploy on demand). Polls until live.
set -e
cd "$(dirname "$0")/.."
export $(grep -v '^#' .env | xargs)
SVC="srv-d95so21oagis7398j89g"

DEP=$(curl -s -m 30 -X POST "https://api.render.com/v1/services/$SVC/deploys" \
  -H "Authorization: Bearer $RENDER_API_KEY" -H 'Content-Type: application/json' \
  -d '{"clearCache":"do_not_clear"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "deploy $DEP triggered"

while true; do
  ST=$(curl -s -m 30 -H "Authorization: Bearer $RENDER_API_KEY" \
    "https://api.render.com/v1/services/$SVC/deploys/$DEP" \
    | python3 -c "import json,sys; print(json.load(sys.stdin).get('status','?'))")
  case "$ST" in
    live) echo "LIVE — https://bbq-build.onrender.com"; exit 0;;
    build_failed|update_failed|canceled|pre_deploy_failed) echo "FAILED: $ST"; exit 1;;
    *) printf '.'; sleep 15;;
  esac
done
