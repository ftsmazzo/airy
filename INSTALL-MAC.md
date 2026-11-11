# Airy no Mac — instalação para testar

Pacote de instalação para o Mac do sócio (Apple Silicon ou Intel). **Não commita** o `.env`.

## 1) One-liner

```bash
git clone https://github.com/ftsmazzo/airy.git
cd airy
chmod +x scripts/setup-mac.sh
./scripts/setup-mac.sh
```

Requisitos: macOS + [Homebrew](https://brew.sh) se o Node 20+ ainda não existir.

## 2) Keys (obrigatório)

Copie o `.env` já preenchido (AirDrop / 1Password) **ou** edite:

```bash
nano .env
```

Precisa de:

| Key | Onde pegar |
|-----|------------|
| `OPENROUTER_API_KEY` | openrouter.ai |
| `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` | ElevenLabs Pro |
| `MCP_TOKEN` | mesmo do ie-dados |
| `AIRY_RADAR_URL` | URL real do Radar Municipal |

Opcionais de voz (já alinhados à conta Pro):

```env
ELEVENLABS_MODEL_ID=eleven_v4
ELEVENLABS_STABILITY=0.35
ELEVENLABS_SIMILARITY=0.75
ELEVENLABS_STYLE=0
ELEVENLABS_SPEED=1.0
```

## 3) Validar

```bash
npm run doctor
npm run smoke:accept
```

Esperado: `Doctor: OK` e `5/5 checks OK` no smoke.

## 4) Ver a orbe (sem mic)

```bash
npm run preview:orb
```

## 5) App completo (Electron)

```bash
npm run dev
```

Na **primeira** fala ou 2 palmas, o macOS pede **Microfone** → Permitir.

### Checklist de aceite (5 min)

| # | Ação | Esperado |
|---|------|----------|
| 1 | Orbe demo / estados | idle → listening → thinking → speaking |
| 2 | Digite: “O que é a CABS?” | Prudente de Morais 457 / 3605-2800 + áudio |
| 3 | “Abre o YouTube” | Safari/Chrome abre YouTube |
| 4 | “Abre o Spotify” | App Spotify ou open.spotify.com |
| 5 | “Abre o Radar Municipal” | abre `AIRY_RADAR_URL` |
| 6 | Espaço = falar | STT → resposta falada |
| 7 | 2 palmas | acorda escuta ( Palmas: on ) |

## Problemas comuns

| Sintoma | Correção |
|---------|----------|
| `MCP_TOKEN` inválido | Colar token de 40 chars do ie-dados (não `...`) |
| Electron não abre | `npm install` de novo na raiz; Node ≥ 20 |
| Sem áudio TTS | Conferir `ELEVENLABS_VOICE_ID` e model `eleven_v4` |
| Mic negado | Ajustes → Privacidade → Microfone → Airy/Electron |
| `.env` não carrega | Arquivo deve estar na **raiz** do repo `airy/.env` |

## Persona

Edite `persona/AIRY_PERSONA.md` e reinicie o `npm run dev`.

## Atualizar depois

```bash
git pull
./scripts/setup-mac.sh
```
