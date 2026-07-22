#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
docker compose --env-file .env.deploy -f docker-compose.production.yml --profile tools run --rm backup
