# TRD — Airy

> Technical Requirements Document — traduz o PRD em decisões técnicas.
> Fonte: [x] Entrevista com usuário  [x] Leitura de código existente
> Depende de: [PRD](PRD.md)

**Data**: 2026-03-13

## 1. Stack tecnológica

| Camada | Tecnologia | Motivo/restrição |
|---|---|---|
| Desktop shell | Electron **33** (`vite-plugin-electron`) | Já é o app; packaging Onda 1 em cima disso *(código)* |
| UI | React **19** + Three.js (orbe) + Vite **6** | As-is |
| Cérebro / tools | `@airy/agent` (TypeScript, Node) | OpenRouter + tools locais + MCP |
| Voz | `@airy/voice` (STT/TTS ElevenLabs, clap) | As-is |
| Monorepo | npm workspaces (`apps/*`, `packages/*`) | Node **≥ 20** |
| Banco (app desktop) | Nenhum servidor DB no cliente | Estado em arquivos + cofre Electron |
| Provisionamento keys (Onda 1.1b) | Serviço HTTP fino na **VPS Fabrica-IA** (EasyPanel) | Token → JSON de credenciais; **sem** painel admin multi-tenant *(usuário)* |
| Persistência do provisionador | Postgres **dedicado** ao serviço (ou store mínimo) | Só mapeamento `token → payload`; least privilege |
| Packaging alvo | electron-builder (ou equivalente) → DMG/NSIS + ícone | Hoje **ausente**; atalho chama `npm run dev` *(gap)* |

## 2. Integrações externas

| Integração | Finalidade | Observações |
|---|---|---|
| OpenRouter | LLM + tools + research (Sonar) | Key no cofre; modelo default Haiku 5.5 |
| ElevenLabs | STT (`scribe_v1`) + TTS | Key + Voice ID; Pro recomendado |
| MCP ie-dados | Dados via path-token `{base}/key/{token}/mcp` | Default EasyPanel; skill em `skills/ie-dados-mcp.md` |
| RSS (G1/UOL/BBC) | Manchetes | Expandir / custom na Onda 1–2 |
| Browser / apps locais | `open_url` / `open_app` | Allowlist em `desktop.ts` — expandir + toggles (PRD 1.2) |
| **Provisionador VPS** (novo) | Entrega de secrets/config por token | Ver §7 |

## 3. Requisitos não-funcionais

- **Performance**: turno de voz utilizável no dia a dia; orquestrador mais barato em token = Onda 2 *(usuário)*.
- **Escalabilidade**: desktop 1 usuário/máquina; provisionador VPS atende N tokens de instalação (volume baixo no início).
- **Segurança** (checklist Fábrica — modo Design, Onda 1):
  - Segredos só no cofre Electron (`safeStorage`); payload do provisionador **não** fica em `.env` commitado nem logado.
  - Endpoint de redeem: **HTTPS**, token de **uso limitado** (ex. N usos ou TTL), rate limit, resposta sem stack trace.
  - Não autenticar o desktop com “API key eterna” compartilhada no binário; o usuário cola/recebe **token de instalação** opaco.
  - Allowlist de URL/app permanece; “abrir tudo” fora de escopo.
  - Mic: permissão explícita do SO; onboarding deve deixar claro o que sobe (áudio→ElevenLabs, texto→OpenRouter).
- **Compliance (LGPD)**: documentar categorias de dado e destinos no onboarding; memória/notas locais.
- **Disponibilidade**: app offline parcial (sem keys/APIs não fala); provisionador precisa `/health`.
- **Idioma**: PT-BR (produto e voz).

## 4. Ambiente e deploy

| Peça | Onde | Notas |
|---|---|---|
| App Airy | Máquina do usuário (Mac/Windows) | Onda 1: pastas `install/mac` e `install/win` + artefatos empacotados |
| Provisionador de credenciais | VPS **Fabrica-IA** / EasyPanel | Serviço isolado + Postgres dedicado; domínio a definir **depois** da doc |
| MCP ie-dados | Já hospedado (EasyPanel) | Continua; Airy só consome |
| CI/CD | Hoje: nenhum pipeline de release no repo | Onda 1: build de instaladores (mínimo manual ou CI depois) |

## 5. Restrições herdadas

- Electron + monorepo atual — **não** reescrever stack na Onda 1.
- APIs OpenRouter + ElevenLabs obrigatórias no curto prazo.
- Cofre local (`airy-secure.json` + `safeStorage`) permanece a fonte de verdade no desktop após o redeem.
- Sem painel admin multi-tenant *(usuário)*.
- Persona “gabinete” no arquivo default é resíduo — generalizar sem bloquear packaging.

## 6. Manutenção

- Mantenedor: Fred / Fábrica *(usuário)*.
- Complexidade aceitável Onda 1: instaladores claros + redeem token simples + UI Start mínima; evitar plataforma de identity.

## 7. Arquitetura alvo — Onda 1 (decisões)

### 7.1 Packaging / pastas

```
install/
  mac/     # scripts + notas de build DMG/.app assinável quando houver cert
  win/     # scripts + notas de build NSIS/.exe
apps/desktop/   # código do app (inalterado como home do produto)
packages/       # agent + voice
```

- Artefato final: app que **não** depende de `git`/`npm` no PATH do usuário.
- Ícone na área de trabalho aponta para o binário instalado (não `npm run dev`).
- Remover/ignorar path hardcoded em `scripts/Airy-desktop.bat` do fluxo de produto.

### 7.2 Bootstrap de credenciais (1.1b) — magro

```
[Usuário] --token--> [Airy Start]
                         |
                         v
              HTTPS GET/POST /redeem
                         |
                         v
              [Provisionador VPS + DB]
                         |
                         v
              JSON versionado → saveSettings() → safeStorage
```

**Shape proposto** (1:1 com `secureConfig` atual):

```json
{
  "version": 1,
  "secrets": {
    "openrouterApiKey": "",
    "elevenApiKey": "",
    "mcpToken": ""
  },
  "public": {
    "elevenVoiceId": "",
    "openrouterModel": "anthropic/claude-haiku-5.5",
    "mcpBaseUrl": "",
    "radarUrl": "",
    "ownerName": "",
    "elevenTtsModel": "eleven_v4",
    "elevenStability": 0.35,
    "elevenSimilarity": 0.75,
    "elevenStyle": 0,
    "elevenSpeed": 1
  }
}
```

- Inbox path / toggles de pacotes: **só locais** (não vêm da VPS).
- Fallback: colar keys manualmente (SetupSheet) se redeem falhar.
- Operação sem admin UI: gravar tokens no DB via script/`execute_mutation` MCP VPS ou seed — aceitável na Onda 1.

### 7.3 Start / allowlist / voz / notícias / MCP (1.2–1.7)

- Start: nome da IA, nome da pessoa, campo token, toggles de pacotes (hosts/apps permitidos).
- Allowlist expandida (lista Ary) + persistência dos toggles no `public` local.
- `open_app` vs `open_url`: flag ou tool distinta; Radar respeita URL salva / preferência app.
- Voz: select + preview TTS antes de save.
- Notícias: fontes selecionáveis + mapa canal→URL (ex. CNN live YouTube).
- MCP: validar health no doctor (lendo cofre, não só `.env`) + skill no prompt.

### 7.4 IPC a acrescentar (proposta)

| Canal | Uso |
|---|---|
| `airy:redeem-token` | Chama provisionador; grava settings |
| (existentes) | `settings-get/save`, turns, speak, pick-folder… |

---

## Gaps & Recomendações (Modo B)

| Severidade | Gap | Recomendação |
|---|---|---|
| alta | Sem instalador real | electron-builder + `install/mac` + `install/win` |
| alta | Credenciais manuais bloqueiam uso (Ary) | Redeem token VPS → cofre (1.1b) |
| alta | Doctor só olha `.env` | Doctor = mesmos campos do cofre + opcional ping MCP/OpenRouter |
| média | Allowlist estreita | Pacote Ary + toggles; nunca allow-all cego |
| média | Radar sempre browser / URL frágil | Preferência app vs URL; URL só da config |
| média | Provisionador novo = superfície de ataque | HTTPS, TTL/usos, rate limit, sem logs de secrets |
| média | Code signing / notarização Mac | Planejar cert; até lá aviso de “não verificado” |
| baixa | `researchModel` / persona só via env | Subir para settings na Onda 1–2 |
| baixa | Path bat commitado de outra máquina | Gerar só no install; não versionar path de usuário |
| info | Google OAuth / orquestrador / artefatos premium | Onda 2–3 (PRD) |

### Segurança — obrigatório na implementação do provisionador

- Token opaco, não previsível; rate limit no `/redeem`
- Resposta só o JSON necessário; nunca logar keys
- Postgres dedicado; secrets no EasyPanel env do **serviço**, não no repo Airy
- Desktop: após redeem, apagar token da UI; não reenviar em todo boot
