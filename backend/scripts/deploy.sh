#!/usr/bin/env bash
# Deploys the unscene.it backend to the linked hosted Supabase project:
#   1. applies pending migrations           (supabase db push)
#   2. uploads Edge Function secrets         (from supabase/functions/.env)
#   3. deploys the classify-frames function
#   4. smoke-tests it                        (no OpenAI calls, no cost)
#
# Usage:   backend/scripts/deploy.sh [--skip-db]
# Once:    supabase login && supabase link --project-ref <ref>   (in backend/)
# db push asks for the database password unless SUPABASE_DB_PASSWORD is set.
set -euo pipefail

cd "$(dirname "$0")/.." # backend/
ENV_FILE="supabase/functions/.env"
FUNCTION="classify-frames"
SKIP_DB=false
for arg in "$@"; do
  case "$arg" in
    --skip-db) SKIP_DB=true ;;
    *) echo "Unknown option: $arg (use --skip-db)" >&2; exit 1 ;;
  esac
done

fail() { echo "✗ $*" >&2; exit 1; }

REF_FILE="supabase/.temp/project-ref"
[[ -f "$REF_FILE" ]] || fail "Not linked. Run: supabase link --project-ref <ref>"
REF="$(cat "$REF_FILE")"
URL="https://$REF.supabase.co"
echo "→ Deploying to $REF ($URL)"

# Guards: never ship mock mode or a missing key to production.
[[ -f "$ENV_FILE" ]] || fail "Missing $ENV_FILE (copy .env.example and add OPENAI_API_KEY)"
grep -qE '^OPENAI_API_KEY=.+' "$ENV_FILE" || fail "OPENAI_API_KEY is empty in $ENV_FILE"
if grep -qE '^MOCK_DECISIONS=true' "$ENV_FILE"; then
  fail "MOCK_DECISIONS=true in $ENV_FILE; set it to false before deploying"
fi

if $SKIP_DB; then
  echo "→ Skipping migrations (--skip-db)"
else
  echo "→ Applying migrations"
  supabase db push
fi

echo "→ Uploading function secrets from $ENV_FILE"
supabase secrets set --env-file "$ENV_FILE" --project-ref "$REF"

echo "→ Deploying $FUNCTION"
supabase functions deploy "$FUNCTION" --project-ref "$REF" --use-api # bundle server-side, no Docker

echo "→ Smoke test (invalid requests only, so no OpenAI calls)"
# --reveal: without it the CLI returns secret keys masked. Kept in memory only.
KEYS_JSON="$(supabase projects api-keys --project-ref "$REF" --reveal -o json)"
api_key() { # api_key <publishable|secret>
  python3 -c '
import json, sys
text = sys.stdin.read()
keys = json.loads(text[text.index("["):])
print(next(k["api_key"] for k in keys if k.get("type") == sys.argv[1]))
' "$1" <<<"$KEYS_JSON"
}
SECRET_KEY="$(api_key secret)"
PUBLISHABLE_KEY="$(api_key publishable)"

status() { # status <apikey> → HTTP status of an empty-body POST
  curl -s -o /dev/null -w '%{http_code}' -X POST "$URL/functions/v1/$FUNCTION" \
    -H "apikey: $1" -H "Content-Type: application/json" -d '{}'
}

# A fresh deploy can take a few seconds to go live.
code=""
for _ in {1..10}; do
  code="$(status "$SECRET_KEY")"
  [[ "$code" == "400" ]] && break
  sleep 3
done
[[ "$code" == "400" ]] || fail "Secret key call returned $code (expected 400 for an empty body)"
echo "  ✓ secret key reaches the function (400 on empty body, rejected before OpenAI)"

code="$(status "$PUBLISHABLE_KEY")"
[[ "$code" == "401" ]] || fail "Publishable key call returned $code (expected 401: AI must stay secret-key only)"
echo "  ✓ publishable key is refused (401)"

code="$(curl -s -o /dev/null -w '%{http_code}' "$URL/rest/v1/content_filters?select=key" -H "apikey: $PUBLISHABLE_KEY")"
[[ "$code" == "200" ]] || fail "Presets query returned $code (expected 200)"
echo "  ✓ presets readable with the publishable key"

cat <<EOF

✓ Deployed. Extension settings (extension/config.js):
  SUPABASE_URL             = "$URL"
  SUPABASE_PUBLISHABLE_KEY = "$PUBLISHABLE_KEY"
EOF
