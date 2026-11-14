# Airy — instalação Windows

## Usuário final (instalador)

1. Baixe `Airy-Setup-0.1.0-x64.exe` (pasta `release/` após o build, ou link que a Fábrica enviar).
2. Execute o instalador → atalho **Airy** na Área de Trabalho e no Menu Iniciar.
3. Abra o Airy → cole o **token de instalação** → autorize o microfone → fale.

Não precisa de Node, Git nem terminal.

> Ainda sem assinatura de código: o Windows pode mostrar “Windows protegeu o PC”. Use “Mais informações” → Executar assim mesmo (enquanto não houver certificado).

## Gerar o instalador (dev)

```powershell
cd D:\Projetos\airy
.\install\win\build.ps1
# ou: npm run dist:win
```

Saída: `release\Airy-Setup-*-x64.exe`

## Setup legado (repo + npm — só desenvolvimento)

```powershell
.\install\win\setup.ps1
```

Requer Node 20+. Cria atalho que ainda usa o fluxo de dev.
