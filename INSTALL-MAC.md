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

## 2) Keys — sem ficar editando `.env`

**Forma recomendada:** abra o app e pressione **`,`** (vírgula) → painel **Ajustes**.

- Segredos (OpenRouter, ElevenLabs, MCP) vão para o **cofre do macOS (Keychain)** via Electron `safeStorage`.
- Nome do dono + URL do Radar ficam em preferência local (`userData`) — **não** em banco remoto.
- Nada disso vai para o GitHub.

Se existir um `.env` antigo na pasta, na 1ª abertura o Airy **importa** para o cofre e você pode apagar o `.env`.

`.env` continua opcional (dev/CI). Obrigatórios no painel:

| Campo | Onde pegar |
|-------|------------|
| OpenRouter API Key | openrouter.ai |
| ElevenLabs API Key + Voice ID | ElevenLabs Pro |
| MCP Token | ie-dados |
| Radar URL / Seu nome | preferências |

Opcionais de voz no cofre/defaults: `eleven_v4`, stability 0.35, etc.

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

## 5) App completo (Electron) — use este, não o preview

```bash
npm run dev
```

- `npm run preview:orb` = **só a orbe** (sem agente; mensagem “Agente indisponível” é esperada).
- `npm run dev` = app fullscreen com voz + MCP.

Na **primeira** fala ou 2 palmas, o macOS pede **Microfone** → Permitir.  
**F11** alterna fullscreen. **/** abre texto opcional.

### Sessão (acordar / dormir)
- **Dormindo** por padrão (não interfere sozinha).
- **2 palmas** ou **Espaço** → acorda e ouve o comando.
- De novo **2 palmas** / **Espaço** / **Esc** enquanto ouve → cancela e dorme.
- Na fala: “para”, “chega”, “desliga”, “dorme” → ela confirma e dorme.
- Depois de cada resposta → volta a **dormir** (precisa acordar de novo).
- No `.env`: `AIRY_OWNER_NAME=Fred` → “Bom dia, Fred” / “Radar aberto, Fred” quando couber.

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
