# Airy — instalação Windows

> Destino do usuário final: app com ícone na Área de Trabalho, **sem** terminal.  
> Enquanto o instalador `.exe` (fatia 1.1) não fecha, use este fluxo de **dev/sócio**.

## Pré-requisitos

- Windows 10/11
- Node.js **20+** (https://nodejs.org) — só neste fluxo intermediário
- Microfone permitido

## Setup (PowerShell)

```powershell
cd D:\Projetos\airy
Set-ExecutionPolicy -Scope Process Bypass
.\install\win\setup.ps1
```

O script: `npm install`, build voice/agent, doctor, atalho **Airy.lnk**.

## Primeiro uso

1. Clique no ícone **Airy** na Área de Trabalho.
2. Start: cole o **token de instalação** (ou Ajustes `,` com keys).
3. Autorize o microfone se o Windows pedir.
4. Espaço / palmas / “Airy …” para falar.

## Credenciais

Use o token da Fábrica. Evite passar `.env` por chat.  
O launcher em `scripts/Airy-desktop.bat` é **gerado** pelo atalho (path da máquina atual) — não edite path de outro PC no Git.

## Empacotamento (próximo)

Artefato alvo: NSIS `.exe` via electron-builder — fatia **1.1** do plano.
