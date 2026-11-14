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

## Ops

```bash
cd services/provisioner
npm install
# migrate + seed (com secrets nas env do shell, não no git)
export DATABASE_URL=...
npm run migrate
TOKEN=... OPENROUTER_API_KEY=... ELEVENLABS_API_KEY=... MCP_TOKEN=... ELEVENLABS_VOICE_ID=... npm run seed
```

No app desktop: `AIRY_PROVISIONER_URL=https://seu-host` (ou default após deploy).
