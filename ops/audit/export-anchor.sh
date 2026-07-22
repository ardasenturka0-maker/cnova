#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL gerekli}"
: "${AUDIT_ANCHOR_KEY:?AUDIT_ANCHOR_KEY gerekli}"
: "${AUDIT_ANCHOR_REMOTE:?AUDIT_ANCHOR_REMOTE gerekli}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
database_url="${AUDIT_DATABASE_URL:-$DATABASE_URL}"
workdir="$(mktemp -d "${TMPDIR:-/tmp}/clinicnova-audit.XXXXXX")"
trap 'rm -rf -- "$workdir"' EXIT
npm run audit:verify
psql "$database_url" --csv --tuples-only --no-align -c 'SELECT DISTINCT ON ("organizationId") "organizationId", "id", "entryHash", "createdAt" FROM "AuditLog" WHERE "entryHash" IS NOT NULL ORDER BY "organizationId", "createdAt" DESC, "id" DESC' > "$workdir/$timestamp.csv"
node -e 'const {createHmac}=require("node:crypto");const {readFileSync}=require("node:fs");process.stdout.write(createHmac("sha256",process.env.AUDIT_ANCHOR_KEY).update(readFileSync(process.argv[1])).digest("hex")+"\n")' "$workdir/$timestamp.csv" > "$workdir/$timestamp.sig"
rclone copy "$workdir" "$AUDIT_ANCHOR_REMOTE/$timestamp" --immutable
echo "Audit zinciri uzak hedefe sabitlendi: $timestamp"
