#!/usr/bin/env bash
# Gera .dmg em release/ (rode em macOS)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
echo "==> Build Airy macOS"
npm run dist:mac
echo "OK. Artefatos em: $ROOT/release/"
ls -la "$ROOT/release/"Airy-*.dmg 2>/dev/null || ls -la "$ROOT/release/"
