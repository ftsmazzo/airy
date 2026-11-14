#!/usr/bin/env bash
# Airy — entrada Mac (install/mac)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
chmod +x scripts/setup-mac.sh
exec bash scripts/setup-mac.sh
