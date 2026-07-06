#!/bin/bash
set -e
export $(grep -v '^#' .env | xargs)
DB_ID="dpg-d95sn5hoagis7398i90g-a"
OWNER="tea-d87q0q67r5hc73evevpg"

DB_URL=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" "https://api.render.com/v1/postgres/$DB_ID/connection-info" | python3 -c "import json,sys; print(json.load(sys.stdin)['internalConnectionString'])")
echo "DB URL acquired (host: $(echo $DB_URL | sed 's/.*@//;s/\/.*//'))"

SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 40)

python3 - "$DB_URL" "$SECRET" "$GEMINI_API_KEY" <<'PYEOF' > /tmp/svc-payload.json
import json, sys
db_url, secret, gemini = sys.argv[1], sys.argv[2], sys.argv[3]
print(json.dumps({
  "type": "web_service",
  "name": "bbq-build",
  "ownerId": "tea-d87q0q67r5hc73evevpg",
  "repo": "https://github.com/sagiro777/bbq-build",
  "branch": "master",
  "autoDeploy": "yes",
  "serviceDetails": {
    "runtime": "node",
    "plan": "free",
    "region": "frankfurt",
    "envSpecificDetails": {
      "buildCommand": "npm install && npm run build",
      "startCommand": "npm start"
    },
    "healthCheckPath": "/api/health"
  },
  "envVars": [
    {"key": "NODE_VERSION", "value": "22"},
    {"key": "BBQ_SECRET", "value": secret},
    {"key": "BBQ_USER_EMAIL", "value": "sagirodin@gmail.com"},
    {"key": "BBQ_USER_PASSWORD", "value": "Ember&Oak-2417"},
    {"key": "GEMINI_API_KEY", "value": gemini},
    {"key": "DATABASE_URL", "value": db_url}
  ]
}))
PYEOF

curl -s -m 90 -X POST https://api.render.com/v1/services \
  -H "Authorization: Bearer $RENDER_API_KEY" -H 'Content-Type: application/json' \
  -d @/tmp/svc-payload.json > /tmp/svc-result.json
python3 -c "
import json
d = json.load(open('/tmp/svc-result.json'))
svc = d.get('service', d)
print('SERVICE:', svc.get('id'), svc.get('slug'))
print('URL:', svc.get('serviceDetails', {}).get('url'))
print('DEPLOY:', d.get('deployId'))
" || cat /tmp/svc-result.json | head -c 800
rm -f /tmp/svc-payload.json
