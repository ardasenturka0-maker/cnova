#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="$(node -p "require('$root/package.json').version")"
apk="$root/releases/ClinicNova-$version.apk"
guide="$root/docs/CLINIC-INSTALL.md"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

[[ -f "$apk" ]] || { echo "APK bulunamadı: $apk" >&2; exit 1; }
[[ -f "$guide" ]] || { echo "Kurulum kılavuzu bulunamadı: $guide" >&2; exit 1; }

mkdir -p "$stage/ClinicNova-Clinic-Install-$version"
cp "$apk" "$guide" "$stage/ClinicNova-Clinic-Install-$version/"
cp .env.production.example "$stage/ClinicNova-Clinic-Install-$version/env.production.example"
cp docker-compose.production.yml "$stage/ClinicNova-Clinic-Install-$version/"
cp -R ops/deploy "$stage/ClinicNova-Clinic-Install-$version/server-deploy"
{
  echo "ClinicNova clinic installation package"
  echo "Version: $version"
  echo "Git commit: $(git -C "$root" rev-parse HEAD)"
  echo "Created: $(date -u +%FT%TZ)"
} > "$stage/ClinicNova-Clinic-Install-$version/INSTALL-MANIFEST.txt"
(cd "$stage/ClinicNova-Clinic-Install-$version" && sha256sum "ClinicNova-$version.apk" > SHA256SUMS)
rm -f "$root/releases/ClinicNova-Clinic-Install-$version.zip"
(cd "$stage" && zip -qr "$root/releases/ClinicNova-Clinic-Install-$version.zip" "ClinicNova-Clinic-Install-$version")
sha256sum "$root/releases/ClinicNova-Clinic-Install-$version.zip"
