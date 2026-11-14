# Airy — Agente do Futuro

Assistente de voz em português: escuta, responde e age com você — orbe vivo, wake por palmas e atalhos do dia a dia.

**Instalação:** [Mac](./install/mac/README.md) · [Windows](./install/win/README.md) · legado Mac: [`INSTALL-MAC.md`](./INSTALL-MAC.md)

Documentação de produto: [`docs/`](./docs/) (PRD → Plano).

## One-liner (Mac)

```bash
git clone https://github.com/ftsmazzo/airy.git
cd airy
chmod +x install/mac/setup.sh && ./install/mac/setup.sh
# npm run doctor && npm run smoke:accept && npm run dev
# No app: token de instalação ou tecla , → keys (cofre do SO). .env é opcional.
```

## One-liner (Windows)

```powershell
git clone https://github.com/ftsmazzo/airy.git
cd airy
.\install\win\setup.ps1
```

## Pré-requisitos

- Node.js **20+**
- Contas de voz e inteligência (configura uma vez no app, tecla `,`)
- macOS ou Windows

## Variáveis (`.env`)

| Variável | Obrigatório | Notas |
|----------|-------------|--------|
| `OPENROUTER_API_KEY` | sim | |
| `OPENROUTER_MODEL` | não | default `anthropic/claude-haiku-5.5` (barato + tools) |
| `ELEVENLABS_API_KEY` | sim | |
| `ELEVENLABS_VOICE_ID` | sim | voz PT-BR na conta Pro |
| `ELEVENLABS_MODEL_ID` | não | ex.: `eleven_v4` |
| `ELEVENLABS_STABILITY` / `SIMILARITY` / `STYLE` / `SPEED` | não | voz |
| `MCP_TOKEN` | sim | mesmo do ie-dados |
| `AIRY_RADAR_URL` | sim para Radar | URL completa do atalho |
| `AIRY_PERSONA_PATH` | não | default `persona/AIRY_PERSONA.md` |

## Uso

- **Espaço** / **Falar**: push-to-talk  
- **2 palmas**: wake (P1)  
- **Orbe demo**: ciclo visual sem voz  
- Persona: edite `persona/AIRY_PERSONA.md`

### Aceite

1. “O que é a CABS?” → Prudente de Morais 457 + (16) 3605-2800  
2. “Abre o Radar Municipal” / YouTube / Spotify  
3. Orbe muda `idle` → `listening` → `thinking` → `speaking`

```bash
npm run doctor
npm run smoke:accept
npm run preview:orb
npm run dev
```

## Por dentro

Desktop com orbe vivo, agente de conversa, voz e persona editável em `persona/AIRY_PERSONA.md`.

**Extras:** pesquisa web, artefato HTML, PDF, **memória local**, **ditado → notas**, **pasta vigiada** (escolhe no `,`). MCP ie-dados continua disponível. Agenda/Cursor depois.

## Repo

https://github.com/ftsmazzo/airy
