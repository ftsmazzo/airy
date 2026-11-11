# Airy

Agente de voz PT-BR (ElevenLabs + OpenRouter) com orbe, MCP **ie-dados** e aberturas simples (Radar Municipal, YouTube, Spotify).

**Instalação no Mac (sócio):** veja [`INSTALL-MAC.md`](./INSTALL-MAC.md)

## One-liner (Mac)

```bash
git clone https://github.com/ftsmazzo/airy.git
cd airy
chmod +x scripts/setup-mac.sh && ./scripts/setup-mac.sh
# npm run doctor && npm run smoke:accept && npm run dev
# No app: tecla , → colar keys (cofre do SO). .env é opcional.
```

## Pré-requisitos

- Node.js **20+**
- Conta **OpenRouter** (modelo com tools)
- Conta **ElevenLabs Pro** (API key + Voice ID PT-BR)
- Token MCP ie-dados (`MCP_TOKEN`)
- macOS recomendado (Windows abre URLs; Spotify via web)

## Variáveis (`.env`)

| Variável | Obrigatório | Notas |
|----------|-------------|--------|
| `OPENROUTER_API_KEY` | sim | |
| `OPENROUTER_MODEL` | não | default `anthropic/claude-sonnet-4.5` |
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

## Arquitetura

- `apps/desktop` — Electron + React + orbe Three.js  
- `packages/agent` — OpenRouter + MCP HTTP + desktop open  
- `packages/voice` — STT/TTS ElevenLabs + detector de palmas  
- `skills/ie-dados-mcp.md` — roteiro tipado do MCP  
- `persona/AIRY_PERSONA.md` — prompt editável  

## Repo

https://github.com/ftsmazzo/airy
