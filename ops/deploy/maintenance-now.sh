#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
set -a
source .env.production
source .env.deploy
set +a
: "${CRON_SECRET:?CRON_SECRET gerekli}"
curl --fail --silent --show-error -H "Authorization: Bearer $CRON_SECRET" "https://$APP_DOMAIN/api/cron/followups" >/dev/null
curl --fail --silent --show-error -H "Authorization: Bearer $CRON_SECRET" "https://$APP_DOMAIN/api/cron/purge-trash" >/dev/null
