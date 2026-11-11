#!/usr/bin/env bash
# Airy — setup no Mac (Apple Silicon / Intel)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Airy setup (macOS)"
echo "    repo: $ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Este script é para macOS. No Windows use: npm install && npm run build -w @airy/voice && npm run build -w @airy/agent"
  exit 1
fi

need_node=0
if ! command -v node >/dev/null 2>&1; then
  need_node=1
else
  major="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "$major" -lt 20 ]]; then
    echo "Node $(node -v) é < 20 — vamos orientar upgrade."
    need_node=1
  fi
fi

if [[ "$need_node" -eq 1 ]]; then
  if ! command -v brew >/dev/null 2>&1; then
    echo "Instale o Homebrew: https://brew.sh"
    echo "Depois rode de novo: ./scripts/setup-mac.sh"
    exit 1
  fi
  echo "==> Instalando Node 22 via Homebrew…"
  brew install node@22 || brew install node
  # shellcheck disable=SC1091
  if [[ -f /opt/homebrew/opt/node@22/bin/node ]]; then
    export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
  fi
fi

echo "==> Node $(node -v) | npm $(npm -v) | arch $(uname -m)"

# Electron precisa do script de download do binário
export npm_config_ignore_scripts=false

echo "==> npm install (pode demorar no 1º Electron)…"
npm install

echo "==> Build packages voice + agent…"
npm run build -w @airy/voice
npm run build -w @airy/agent

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "==> Criado .env a partir de .env.example — PREENCHA as keys antes de testar."
else
  echo "==> .env já existe (não sobrescrito)."
fi

echo "==> Doctor…"
node scripts/doctor.mjs || true

echo "==> Atalho na Área de Trabalho (ícone Airy)…"
node scripts/install-desktop-shortcut.mjs || true

cat <<'EOF'

==> Pronto para o próximo passo

1) Keys: no app use a tecla , (ou .env opcional)
2) Valide:  npm run doctor
3) Smoke:   npm run smoke:accept
4) App:     npm run dev   — ou duplo clique em Airy na Área de Trabalho
   → macOS vai pedir microfone na 1ª fala/palmas — permita.

Guia completo: INSTALL-MAC.md
EOF
