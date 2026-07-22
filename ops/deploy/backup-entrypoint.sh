#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "/usr/local/bin/clinicnova-restore-test" ]]; then
  exec gosu postgres "$@"
fi
install -d -o postgres -g postgres -m 0700 /var/backups/clinicnova /var/lib/postgresql/.config/rclone
if [[ -f /run/secrets/rclone.conf ]]; then
  install -o postgres -g postgres -m 0600 /run/secrets/rclone.conf /var/lib/postgresql/.config/rclone/rclone.conf
fi
exec gosu postgres "$@"
