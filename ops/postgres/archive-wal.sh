#!/usr/bin/env bash
set -euo pipefail

: "${WAL_ARCHIVE_ROOT:?WAL_ARCHIVE_ROOT gerekli}"
source_path="${1:?WAL kaynak yolu gerekli}"
wal_name="${2:?WAL dosya adı gerekli}"
install -d -m 0700 "$WAL_ARCHIVE_ROOT"
destination="$WAL_ARCHIVE_ROOT/$wal_name"
if [[ ! -f "$destination" ]]; then
  temporary="$destination.$$.tmp"
  trap 'rm -f -- "$temporary"' EXIT
  install -m 0600 "$source_path" "$temporary"
  mv "$temporary" "$destination"
fi
