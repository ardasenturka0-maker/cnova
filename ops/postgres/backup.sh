#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL gerekli}"
: "${BACKUP_ROOT:?BACKUP_ROOT gerekli}"
: "${WAL_ARCHIVE_ROOT:?WAL_ARCHIVE_ROOT gerekli}"
: "${BACKUP_REMOTE:?BACKUP_REMOTE rclone hedefi gerekli}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="$BACKUP_ROOT/base/$timestamp"
database_url="${BACKUP_DATABASE_URL:-$DATABASE_URL}"
install -d -m 0700 "$destination/base"
[[ -d "$WAL_ARCHIVE_ROOT" ]] || install -d -m 0700 "$WAL_ARCHIVE_ROOT"

pg_basebackup --dbname="$database_url" --pgdata="$destination/base" --format=plain --wal-method=stream --checkpoint=fast --progress
pg_dump --dbname="$database_url" --format=custom --file="$destination/clinicnova.dump"
date -u +%FT%TZ > "$destination/completed-at.txt"
(cd "$destination" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum) > "$destination/SHA256SUMS"

rclone copy "$destination" "$BACKUP_REMOTE/base/$timestamp" --immutable
rclone copy "$WAL_ARCHIVE_ROOT" "$BACKUP_REMOTE/wal" --immutable

# Yerel tam yedekler 35 gün tutulur. Uzak hedefin retention/immutability
# politikası sağlayıcı tarafında ayrıca etkinleştirilmelidir.
find "$BACKUP_ROOT/base" -mindepth 1 -maxdepth 1 -type d -mtime +35 -exec rm -rf -- {} +
echo "Tam yedek ve uzak kopya tamamlandı: $timestamp"
