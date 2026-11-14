# Airy provisioner

Serviço magro: `POST /v1/redeem` com `{ "token": "..." }` → payload de credenciais.  
Sem painel admin. Deploy na VPS Fabrica-IA (EasyPanel) + Postgres dedicado.

## Endpoints

| Método | Path | Auth |
|---|---|---|
| GET | `/health` | — |
| POST | `/v1/redeem` | token no body |

## Env

- `DATABASE_URL` — Postgres
- `PORT` — default 8080
- `RATE_MAX_PER_MIN` — default 20
- `BOOTSTRAP_TOKEN` — (ops) token em claro entregue ao usuário; upsert no boot
- `OPENROUTER_API_KEY` / `ELEVENLABS_API_KEY` / `MCP_TOKEN` / `ELEVENLABS_VOICE_ID` — payload do bootstrap
- `BOOTSTRAP_MAX_USES` / `BOOTSTRAP_EXPIRES_DAYS` / `BOOTSTRAP_LABEL` — opcionais

## Produção (Fabrica-IA)

- Projeto EasyPanel: `airy`
- App: `provisioner` → https://airy-provisioner.kxryyk.easypanel.host
- Postgres: `airy-db`
- Para emitir token: preencha as env de keys + `BOOTSTRAP_TOKEN=...` no serviço e redeploy.

## Ops local

```bash
cd services/provisioner
npm install
export DATABASE_URL=...
npm run migrate
TOKEN=... OPENROUTER_API_KEY=... ELEVENLABS_API_KEY=... MCP_TOKEN=... ELEVENLABS_VOICE_ID=... npm run seed
```

No desktop: default `AIRY_PROVISIONER_URL=https://airy-provisioner.kxryyk.easypanel.host`
