@echo off
title Airy
REM Launcher relativo ao repo. O atalho (npm run desktop-shortcut) regenera
REM este arquivo com cd absoluto da maquina atual — nao commite path de outro PC.
cd /d "%~dp0.."
where npm >nul 2>nul
if errorlevel 1 (
  echo npm nao encontrado. Instale Node 20+ e tente de novo.
  pause
  exit /b 1
)
node scripts\launch-airy.mjs
if errorlevel 1 pause
