@echo off
title Airy
cd /d "C:\Users\anjo_\OneDrive\Projetos-FabriaIA\airy"
where npm >nul 2>nul
if errorlevel 1 (
  echo npm nao encontrado. Instale Node 20+ e tente de novo.
  pause
  exit /b 1
)
node scripts\launch-airy.mjs
if errorlevel 1 pause
