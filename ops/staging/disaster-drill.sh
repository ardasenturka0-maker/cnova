#!/usr/bin/env bash
set -euo pipefail
: "${STAGING_APP_URL:?STAGING_APP_URL gerekli}"
: "${BACKUP_ROOT:?BACKUP_ROOT gerekli}"
: "${WAL_ARCHIVE_ROOT:?WAL_ARCHIVE_ROOT gerekli}"
: "${RESTORE_TEST_DATABASE:?RESTORE_TEST_DATABASE gerekli}"
case "$STAGING_APP_URL" in https://staging.*|http://localhost:*|http://127.0.0.1:*) ;; *) [[ "${STAGING_CONFIRMATION:-}" == "I_UNDERSTAND_THIS_IS_STAGING" ]] || { echo "Staging adresi doğrulanamadı." >&2; exit 1; };; esac
curl --fail --silent --show-error "$STAGING_APP_URL/api/health" >/dev/null
curl --fail --silent --show-error "$STAGING_APP_URL/api/ready" >/dev/null
bash ops/postgres/restore-test.sh
LOAD_TEST_URL="$STAGING_APP_URL" npm run test:load
echo "Staging sağlık, readiness, geri yükleme ve yük provası başarılı."
