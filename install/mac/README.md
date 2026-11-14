# Airy — instalação macOS

> Destino do usuário final: app com ícone, **sem** depender de Claude/Cursor.  
> Enquanto o instalador `.dmg` (fatia 1.1) não fecha, use este fluxo de **dev/sócio**.

## Pré-requisitos

- macOS 12+
- Microfone permitido ao Airy

## Setup (desenvolvimento / handoff)

```bash
cd /caminho/para/airy
chmod +x install/mac/setup.sh
./install/mac/setup.sh
```

O script chama o setup da raiz, roda o doctor (agora aceita cofre do app) e cria o atalho **Airy.app** na Área de Trabalho.

## Primeiro uso

1. Duplo clique em **Airy** na Área de Trabalho.
2. Se pedir configuração: cole o **token de instalação** (ou keys manuais em Ajustes `,`).
3. Autorize o microfone.
4. Espaço / 2 palmas / “Airy …” para falar.

## Credenciais

Preferência: token provisionado pela Fábrica (não espalhar `.env` por AirDrop).  
`.env` na raiz do repo continua opcional (importa uma vez para o cofre).

## Empacotamento (próximo)

Artefato alvo: `.app` / `.dmg` via electron-builder — ver `docs/PLANO-IMPLEMENTACAO.md` fatia **1.1**.
