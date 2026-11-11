# Airy

Agente de voz PT-BR (ElevenLabs + OpenRouter) com orbe, MCP **ie-dados** e aberturas simples (Radar Municipal, YouTube, Spotify).

## Pré-requisitos

- Node.js **20+**
- Conta **OpenRouter** (modelo com tools)
- Conta **ElevenLabs Pro** (API key + Voice ID PT-BR)
- Token MCP ie-dados (`MCP_TOKEN`)
- macOS recomendado (Windows abre URLs; Spotify via web)

## Setup (Mac do sócio)

```bash
cd airy
cp .env.example .env
# edite .env: OPENROUTER_*, ELEVENLABS_*, MCP_TOKEN, AIRY_RADAR_URL

npm install
npm run build -w @airy/voice
npm run build -w @airy/agent
npm run dev
```

No `.env`:

| Variável | Obrigatório | Notas |
|----------|-------------|--------|
| `OPENROUTER_API_KEY` | sim | |
| `OPENROUTER_MODEL` | não | default `anthropic/claude-sonnet-4.5` |
| `ELEVENLABS_API_KEY` | sim | |
| `ELEVENLABS_VOICE_ID` | sim | voz PT-BR na conta Pro |
| `MCP_TOKEN` | sim | mesmo do ie-dados |
| `AIRY_RADAR_URL` | sim para Radar | URL completa do atalho |

## Uso

- **Espaço** ou botão **Falar**: push-to-talk (segura/grava → solta/processa).
- Campo de texto: pergunta sem microfone.
- Orbe: `idle` / `listening` / `thinking` / `speaking`.

### Exemplos de aceite

1. “O que é a CABS e como agendo?” → Prudente de Morais 457 + (16) 3605-2800  
2. “Abre o Radar Municipal” → abre `AIRY_RADAR_URL`  
3. “Abre o YouTube” / “Abre o Spotify”  
4. “PIB per capita de Ribeirão” → tool `get_pib`

## Arquitetura

- `apps/desktop` — Electron + React + orbe Three.js  
- `packages/agent` — OpenRouter + MCP HTTP + desktop open  
- `packages/voice` — STT/TTS ElevenLabs  
- `skills/ie-dados-mcp.md` — roteiro tipado do MCP  

## Fora do MVP

- Duas palmas (P1)
- Ler arquivos / autonomia complexa
- Modelo 100% local como cérebro de tools

## Smoke sem UI (opcional)

Com `.env` preenchido e packages buildados:

```bash
node scripts/smoke-text.mjs "O que é a CABS em Ribeirão Preto?"
```
