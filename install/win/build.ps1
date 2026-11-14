# Gera instalador Windows (NSIS) em D:\Projetos\airy\release\
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

Write-Host "==> Build Airy Windows installer"
Write-Host "    repo: $Root"

npm run dist:win
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "OK. Instalador em: $Root\release\"
Get-ChildItem "$Root\release\Airy-Setup-*.exe" | ForEach-Object { Write-Host "  $($_.FullName)" }
