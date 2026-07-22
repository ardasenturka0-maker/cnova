#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Bu komut root olarak çalıştırılmalı: sudo bash ops/deploy/install-ubuntu.sh" >&2
  exit 1
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

[[ -f .env.deploy ]] || { echo ".env.deploy eksik; ops/deploy/env.deploy.example dosyasından oluşturun." >&2; exit 1; }
[[ -f .env.production ]] || { echo ".env.production eksik; .env.production.example dosyasından oluşturun." >&2; exit 1; }
[[ -f ops/deploy/secrets/rclone.conf ]] || { echo "Uzak yedek için ops/deploy/secrets/rclone.conf eksik." >&2; exit 1; }

set -a
source .env.deploy
set +a
[[ "$APP_DOMAIN" != *example* && "$APP_DOMAIN" == *.* ]] || { echo "APP_DOMAIN gerçek alan adı olmalı." >&2; exit 1; }
[[ "$POSTGRES_PASSWORD" != *REPLACE* && ${#POSTGRES_PASSWORD} -ge 24 && "$POSTGRES_PASSWORD" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "PostgreSQL parolası en az 24 karakter, benzersiz ve yalnız A-Z/a-z/0-9/_/- karakterlerinden oluşmalı." >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y docker.io docker-compose-v2 ufw fail2ban unattended-upgrades curl ca-certificates
systemctl enable --now docker fail2ban unattended-upgrades

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

docker compose --env-file .env.deploy -f docker-compose.production.yml build app migrate bootstrap backup restore-test ops-check audit-anchor
docker compose --env-file .env.deploy -f docker-compose.production.yml up -d db antivirus
docker compose --env-file .env.deploy -f docker-compose.production.yml --profile tools run --rm migrate
docker compose --env-file .env.deploy -f docker-compose.production.yml up -d app caddy

cat > /etc/cron.d/clinicnova <<EOF
15 2 * * * root cd $root && bash ops/deploy/backup-now.sh >> /var/log/clinicnova-backup.log 2>&1
30 4 * * 0 root cd $root && bash ops/deploy/restore-test-now.sh >> /var/log/clinicnova-restore.log 2>&1
*/5 * * * * root cd $root && docker compose --env-file .env.deploy -f docker-compose.production.yml --profile tools run --rm ops-check >> /var/log/clinicnova-ops.log 2>&1
45 1 * * * root cd $root && docker compose --env-file .env.deploy -f docker-compose.production.yml --profile tools run --rm audit-anchor >> /var/log/clinicnova-audit.log 2>&1
10 3 * * * root cd $root && bash ops/deploy/maintenance-now.sh >> /var/log/clinicnova-maintenance.log 2>&1
EOF
chmod 0644 /etc/cron.d/clinicnova

for _ in $(seq 1 30); do
  if curl --fail --silent --show-error "https://$APP_DOMAIN/api/health" >/dev/null && curl --fail --silent --show-error "https://$APP_DOMAIN/api/ready" >/dev/null; then
    echo "ClinicNova hazır: https://$APP_DOMAIN"
    exit 0
  fi
  sleep 10
done

echo "Servisler başladı ancak health/readiness doğrulaması tamamlanmadı." >&2
docker compose --env-file .env.deploy -f docker-compose.production.yml ps
exit 1
