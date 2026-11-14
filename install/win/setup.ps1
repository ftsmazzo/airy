# Airy — entrada Windows (install/win)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

Write-Host "==> Airy setup (Windows)"
Write-Host "    repo: $Root"

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Error "Node.js nao encontrado. Instale Node 20+ em https://nodejs.org e rode de novo."
}
$major = [int]((node -p "process.versions.node.split('.')[0]"))
if ($major -lt 20) {
  Write-Error "Node $(node -v) e < 20. Atualize para Node 20+."
}

Write-Host "==> Node $(node -v) | npm $(npm -v)"
$env:npm_config_ignore_scripts = "false"

Write-Host "==> npm install..."
npm install

Write-Host "==> Build @airy/voice + @airy/agent..."
npm run build -w @airy/voice
npm run build -w @airy/agent

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "==> Criado .env — preferivel usar token no app; .env e opcional."
}

Write-Host "==> Doctor..."
npm run doctor

Write-Host "==> Atalho na Area de Trabalho..."
npm run desktop-shortcut

Write-Host ""
Write-Host "OK. Abra o icone Airy na Area de Trabalho."
Write-Host "No app: cole o token de instalacao (ou tecla , para keys)."
