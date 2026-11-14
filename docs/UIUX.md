# UI/UX Design — Airy

> Direção visual e de experiência.
> Fonte: [x] Entrevista com usuário  [x] Leitura de código existente · skill `impeccable` (contexto + onboard)
> Depende de: [Fluxo do App](FLUXO-APP.md)

**Data**: 2026-03-13

## 1. Referências e tom

- **Incumbente (código)** *(autoridade visual)*: desktop fullscreen “Jarvis / FUI” — orbe 3D ciano no centro, HUD discreto, dark navy/cyan (`global.css`, `Orb.tsx`). Tipografia Orbitron (marca/status) + IBM Plex Sans (UI).
- **Tom**: assessor calmo e premium; sério sem burocracia; a orbe é o produto; config é Operate (clareza > espetáculo).
- **Aha moment (Onda 1)**: ícone → Start com **um token** → orbe responde à voz. Tudo que atrasa isso (colar 5 keys, terminal) é anti-UX *(Ary + Fred)*.
- **Não fazer**: redesign “SaaS roxo/creme”; não transformar a home numa dashboard; não cobrir a orbe com cards no primeiro viewport.

## 2. Plataformas-alvo

- [x] **Desktop** (Electron — Mac e Windows) — único alvo da Onda 1
- [ ] Web responsivo / PWA / mobile nativo — fora

Modos por superfície (`impeccable`):

| Superfície | Modo | Prioridade |
|---|---|---|
| Home (orbe) | **Experience** | Presença, estados, motion do orbe |
| Start (primeiro uso) | **Operate** + onboard | Tempo até valor; 1 ação principal |
| Ajustes | **Operate** | Scanabilidade, toggles, preview de voz |

## 3. Sistema visual

### As-is (preservar e estender)

| Token | Valor |
|---|---|
| `--bg` | `#02040a` |
| glow stage | `#071525` → bg |
| `--fg` | `#e8f7ff` |
| `--muted` | `#7f9bb0` |
| `--cyan` / `--cyan-hot` | `#3ecbff` / `#6af0ff` |
| `--ok` / `--danger` | `#5cffd2` / `#ff6b8a` |
| Display | Orbitron 500/700 |
| UI | IBM Plex Sans 400/500 |

### Componentes centrais (Onda 1)

| Componente | Uso |
|---|---|
| **OrbStage** | Home — idle / listening / thinking / speaking |
| **StartGate** | Novo — fullscreen ou sheet dominante no 1º boot sem secrets |
| **SettingsPanel** | Evolução do `SetupSheet` — seções, não um formulário infinito |
| **TokenField** | Redeem VPS (ação primária no Start) |
| **VoicePicker** | Lista + botão Preview → só então Salvar |
| **PackageToggles** | Liga/desliga sites/apps do pacote Ary |
| **NewsSources** | Checklist + URL custom (portal local) |
| **StatusChip** | dormindo / ouvindo / busy (já existe, refinar copy) |
| **ErrorLine** | Mensagens curtas PT-BR (clarify): “Token expirado — cole outro ou use keys manuais” |

### Motion

- Orbe: manter 2–3 intenções (idle pulse, listening react, speaking energy) — já no Three.js.
- Start/Ajustes: enter/exit curto do painel; preview de voz = feedback imediato (estado “tocando…”).
- Evitar glow excessivo / pills decorativas na config.

## 4. Acessibilidade

- Alvo: WCAG **2.2 AA** nas superfícies Operate (Start/Ajustes): contraste texto, foco visível, labels em todo input, teclado (Esc fecha, Tab ordem lógica).
- Home Experience: status também em texto (já há chip), não só cor do orbe.
- Mic: copy clara do que será gravado/enviado (LGPD leve no Start).
- Público: gestores não técnicos — zero jargão de API no caminho feliz (“Token de instalação”, não “MCP_BASE_URL”).

## 5. Telas principais

| Tela | Jornada | Estado |
|---|---|---|
| Instalador OS (nativo) | B | Fora do React; branding alinhado (ícone AIRY) |
| **Start** — primeiro uso | B | **A desenhar Onda 1** |
| Home orbe | C | Existe — preservar |
| Sheet texto `/` | C | Existe — manter secundário |
| **Ajustes** (`,`) | D | Existe frágil → redesenhar seções |
| (Depois) OAuth Google | Onda 3 | Não na Onda 1 |

### Wire conceitual — Start (Operate / onboard)

Uma composição, um job: **desbloquear a voz**.

1. Marca **Airy** (hero-level no painel, sem competir com orbe se orbe estiver atrás escurecida).
2. Uma linha: “Cole o token que você recebeu.”
3. Campo token + CTA **Ativar**.
4. Link secundário: “Prefiro colar as chaves” → seção manual colapsada.
5. Opcional na mesma tela ( Progressive disclosure ): nome da pessoa / nome da IA.
6. Após OK → some o Start → orbe + hint “Espaço para falar” / “Diga Airy”.

Não no Start: lista enorme de pacotes, RSS, pasta (isso é Ajustes).

### Wire conceitual — Ajustes (seções)

1. **Identidade** — nome da IA, como chama você  
2. **Voz** — Voice ID/lista + Preview + Salvar  
3. **Cérebro** — modelo OpenRouter (select)  
4. **Conexões** — token MCP status, Radar URL, preferência app vs browser  
5. **Pacotes** — toggles ChatGPT, Claude, Notion, Canva…  
6. **Notícias** — fontes + atalhos canal→URL  
7. **Pasta vigiada** — picker + auto-PDF  
8. **Credenciais** — status cofre + “Trocar token” / keys manuais  

## 6. UX copy (clareza)

| Situação | Copy sugerida |
|---|---|
| Redeem OK | “Pronto. Pode falar com a Airy.” |
| Token inválido | “Este token não vale mais. Peça outro ou use chaves manuais.” |
| URL bloqueada | “Esse site está desligado nos Pacotes. Ligue em Ajustes.” |
| App vs web | Pedido “abre o app do Radar” → app; “abre o Radar” → URL config |

---

## Gaps & Recomendações (Modo B)

- [x] **Gap**: sem Start — aha depende de `,` + várias keys *(Ary)*.  
  **Rec**: StartGate com token primeiro; keys manuais escondidas.

- [x] **Gap**: SetupSheet é um formulário só; knobs faltando; sem preview de voz.  
  **Rec**: SettingsPanel seccionado (lista acima).

- [x] **Gap**: allowlist invisível ao usuário (só erro falado/retornado).  
  **Rec**: Pacotes = toggles explícitos.

- [x] **Gap**: sem PRODUCT.md / DESIGN.md no repo (Impeccable).  
  **Rec**: após Onda 1 estável, `/impeccable init` + `document` para capturar o sistema ciano/orbe.

- [x] **Gap**: “Radar Municipal” ainda no label — produto não é Gabinete2.  
  **Rec**: label genérico “URL do Radar / atalho principal” + nome editável.

- [x] **Gap**: artefatos HTML premium = Onda 2 (craft próprio, não misturar no Start).
