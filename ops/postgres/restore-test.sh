#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_ROOT:?BACKUP_ROOT gerekli}"
: "${WAL_ARCHIVE_ROOT:?WAL_ARCHIVE_ROOT gerekli}"

backup="${1:-}"
if [[ -z "$backup" ]]; then
  while IFS= read -r candidate; do backup="$candidate"; done < <(find "$BACKUP_ROOT/base" -mindepth 1 -maxdepth 1 -type d | sort)
fi
[[ -n "$backup" && -d "$backup/base" ]] || { echo "Test edilecek tam yedek bulunamadı." >&2; exit 1; }

workdir="$(mktemp -d "${TMPDIR:-/tmp}/clinicnova-restore.XXXXXX")"
socket_dir="$workdir/socket"
data_dir="$workdir/data"
port="${RESTORE_TEST_PORT:-55432}"
cleanup() {
  pg_ctl -D "$data_dir" -m immediate stop >/dev/null 2>&1 || true
  rm -rf -- "$workdir"
}
trap cleanup EXIT

install -d -m 0700 "$socket_dir"
cp -a "$backup/base" "$data_dir"
rm -f "$data_dir/postmaster.pid" "$data_dir/standby.signal"
cat >> "$data_dir/postgresql.auto.conf" <<EOF
port = $port
listen_addresses = ''
unix_socket_directories = '$socket_dir'
restore_command = 'cp $WAL_ARCHIVE_ROOT/%f %p'
recovery_target_action = 'promote'
EOF
touch "$data_dir/recovery.signal"

pg_ctl -D "$data_dir" -w -t 120 start
psql -h "$socket_dir" -p "$port" -d clinicnova -v ON_ERROR_STOP=1 -c "SELECT now(), count(*) AS migrations FROM \"_prisma_migrations\";"
pg_ctl -D "$data_dir" -w stop
echo "Geri yükleme testi başarılı: $(basename "$backup")"
