# PRD — Airy

> Product Requirements Document — o quê e por quê, não como.
> Fonte: [x] Entrevista com usuário  [x] Leitura de código existente

**Data**: 2026-03-13  
**Responsável**: Fred (ftsmazzo)  
**Repo**: https://github.com/ftsmazzo/airy · local `D:\Projetos\airy` · branch principal `main` · versão código `0.1.0`

## 1. Resumo em uma frase

**Airy** é um agente de voz desktop em português que escuta, responde e age no computador do usuário — e deve evoluir de protótipo instalado via repo/IA para **produto empacotado**, com ícone na área de trabalho, onboarding sem terminal, e papel de **canal de comunicação gerencial** para outras soluções.

## 2. Problema e contexto

- **Problema real** *(usuário)*: a instalação e o “deixar funcionando” hoje passam por clone do GitHub, Node, npm, scripts e (na prática) assistência de Claude/Cursor/Codex. IAs contornam atritos do percurso; um usuário final sem isso tende a falhar ou desistir. O resultado desejado — agente estável com ícone na área de trabalho, sem erros — ainda não é garantido por um fluxo de produto.
- **Como é resolvido hoje** *(código)*: `git clone` → `npm install` / `setup-mac.sh` → keys no painel `,` ou `.env` → `npm run doctor` / smoke → `npm run dev` ou atalho que ainda dispara o fluxo de desenvolvimento (`npm run dev` na pasta do repo). Ver `README.md`, `INSTALL-MAC.md`, `scripts/setup-mac.sh`, `scripts/install-desktop-shortcut.mjs`.
- **Por que agora** *(usuário)*: o produto precisa ser comercializável e bem maior do que o MVP atual — empacotamento (instalador + onboarding), config robusta/personalização, e posicionamento como canal gerencial ligado a outras soluções — sem “errar a forma” de organizar pastas e o percurso de instalação.

## 3. Público-alvo

- **Persona de produto (decidido)** *(usuário)*: usuário **não técnico** (gestor / operação) que recebe o Airy como produto, não como repositório; usa voz como canal gerencial para consultar e acionar outras soluções. **Não** ancorar o produto em “Gabinete2” / gabinete Ribeirão como identidade comercial.
- **Resíduo no código** *(código — persona/AIRY_PERSONA.md)*: a persona commitada ainda fala em assessor de gabinete (Ribeirão). Tratar como **conteúdo default a generalizar** na onda de config/personalização — não como posicionamento do produto.
- **Outros perfis**: operador técnico só no bastidor (build/packaging); white-label depois, se fizer sentido.

## 4. Objetivos e métricas de sucesso

| Objetivo | Métrica | Meta |
|---|---|---|
| Instalação sem IA/terminal | Usuário consegue instalar e abrir pelo ícone da área de trabalho | **Sucesso Onda 1 (fechado):** instalar → ícone → abrir → configurar keys na UI → falar e receber resposta, **sem terminal** (Mac e Windows) |
| Agente “verde” no primeiro uso | Setup completo (keys + mic + validação mínima) sem erro bloqueante | Onboarding na UI; doctor alinhado ao cofre do SO (mesmo critério da Onda 1) |
| Config e personalização | Cobertura de preferências na tela de Ajustes vs. só `.env` | Tudo que o usuário precisa ajustar está no painel (voz, modelo, MCP, persona, pastas, etc.) |
| Canal gerencial | Integrações acionáveis por voz a partir do Airy | Pelo menos o ecossistema atual (MCP ie-dados + atalhos) estável; roadmap de outras soluções *(a detalhar)* |
| Comercialização | Clareza de oferta vs. protótipo interno | Empacotamento + narrativa de produto; licenciamento/billing **fora do primeiro corte** se assim decidido |

> Métricas numéricas (tempo de install, % sucesso, NPS) **ainda não existem** no projeto *(código)*. Precisam ser definidas pelo responsável.

## 5. Escopo

### Dentro do escopo (visão de produto — ondas)

Trabalho em **partes menores**, mas a visão cobre os três eixos:

1. **Distribuição empacotada** — instalador / app real (não atalho → `npm run dev`); ícone na área de trabalho; percurso Mac e Windows sem depender de Claude/Cursor.
2. **Onboarding e configuração robusta** — tela de Ajustes mais completa e personalizável; persona e parâmetros de voz/modelo/MCP na UI; doctor/validação alinhados ao que o app realmente usa.
3. **Evolução de produto / canal gerencial** — reforçar e expandir o que o agente faz (já há núcleo forte); posicionar Airy como interface de voz para outras soluções (começando pelo que já existe: MCP ie-dados, Radar, tools desktop).

### Fora do escopo (por enquanto — proposta para validar)

- Billing, store pública (App Store / Microsoft Store) e white-label completo na **primeira onda**.
- Substituir ElevenLabs/OpenRouter por stack 100% self-hosted na primeira onda.
- “Agenda” e “Cursor como agente” como produto (já citados no README como *depois*) — entram só se priorizados explicitamente.
- Backend multi-tenant SaaS na nuvem (hoje o produto é **desktop local**).

### Escopo da documentação Blueprint (este ciclo)

Os 6 docs em `docs/` descrevem o **as-is** e os gaps; o **Plano de Implementação** quebrará as ondas em entregas pequenas e testáveis (instalador → onboarding → config → features comerciais).

## 6. Funcionalidades principais

| Funcionalidade | Prioridade | Descrição curta | Fonte |
|---|---|---|---|
| Orbe + sessão dorme/acorda | MVP (existe) | UI fullscreen, estados idle/listening/thinking/speaking | código |
| PTT (Espaço), wake palmas, wake por nome | MVP (existe) | Entrada de voz sem digitar | código |
| STT/TTS ElevenLabs + LLM OpenRouter | MVP (existe) | Pipeline de conversa | código |
| Tools desktop (Radar, YT, Spotify, open_app/url) | MVP (existe) | Agir no SO/browser | código |
| MCP ie-dados | MVP (existe) | Dados públicos Ribeirão / gabinete | código |
| Memória, notas, pasta vigiada, PDF, research, artefato HTML | MVP+ (existe) | Extras locais | código |
| Ajustes (tecla `,`) + cofre do SO | MVP (existe, incompleto vs. desejo) | Keys e preferências | código + usuário |
| Instalador + ícone sem Node | **Onda 1 produto** | Distribuição para usuário final | usuário |
| Config UI robusta / personalização | **Onda 2** | Tudo na tela; menos `.env` | usuário |
| Canal gerencial p/ outras soluções | **Onda 3+** | Integrações e posicionamento comercial | usuário |
| Agenda / Cursor-agente | Depois | Roadmap README | código (não implementado como produto) |

## 7. Restrições de negócio

- **Prazo**: trabalhar por partes menores; sem big-bang *(usuário)*.
- **Orçamento**: APIs pagas (OpenRouter + ElevenLabs) já são dependência operacional *(código)*; custo de assinatura de app / notarização Mac a considerar na onda de packaging *(a definir)*.
- **Legais/regulatórias (LGPD)**: microfone, memória local em `~/Airy`, gravações/STT enviados a terceiros — **não documentado formalmente** *(gap)*. Consentimento e retenção precisam entrar no TRD/UI.

## 8. Riscos e premissas

- **Premissa**: o usuário final **não** terá Git/Node/IA de coding — se falsa, o empacotamento perde prioridade.
- **Premissa**: keys OpenRouter + ElevenLabs + MCP continuam necessárias no curto prazo (ou há proxy/licença gerenciada depois).
- **Risco**: atalho atual mascara um app de desenvolvimento — “parece instalado” mas quebra com path/npm/postinstall *(alto)*.
- **Risco**: `doctor` olha `.env` e não o cofre — falso negativo no suporte *(médio)*.
- **Risco**: persona e MCP muito “gabinete Ribeirão” limitam oferta genérica sem camada de white-label/config *(médio)*.
- **Risco**: mic/wake passivo sem política clara de privacidade atrasa venda B2B *(médio)*.

---

## Gaps & Recomendações (Modo B)

- [x] **Gap**: distribuição = repo + npm, não produto na caixa.  
  **Recomendação**: Onda 1 = empacotar Electron (instalador Mac/Windows), atalho real, remover path hardcoded de `scripts/Airy-desktop.bat` commitado, guia Windows.

- [x] **Gap**: onboarding frágil para não-técnicos; dependência de IA no percurso.  
  **Recomendação**: wizard de primeiro uso (keys, mic, teste de voz, validação MCP) + doctor lendo o mesmo store que o app.

- [x] **Gap**: SetupSheet incompleto vs. knobs reais (TTS params, research model, MCP URL, persona).  
  **Recomendação**: Onda 2 = tela de configuração robusta e personalização (incl. editar/trocar persona).

- [x] **Gap**: produto “menor” que o potencial comercial como canal gerencial.  
  **Recomendação**: após base estável, PRD de integrações (catálogo de soluções acionáveis por voz) sem misturar com a onda de instalador.

- [x] **Gap**: métricas de sucesso da Onda 1 — **fechado** com o critério install→ícone→keys→voz. Persona comercial: **fora Gabinete2**; generalizar persona default.

- [x] **Gap**: LGPD / privacidade de áudio não tratados como requisito de produto.  
  **Recomendação**: incluir no TRD e no onboarding (consentimento mic, o que sobe para ElevenLabs/OpenRouter).

---

## Apontamentos — feedback + recorte de ondas

### Feedback Ary (usuária / agência) — 2026-03

Fonte: **resposta do usuário** (relato de uso). Instalou no notebook (ok); na máquina da agência a versão atualizada repetiu erros → tentou voltar à versão do notebook (não terminou).

1. **Allowlist de sites/serviços** — bloqueia até sites básicos. Pediu lista pré-autorizada (ChatGPT, Claude, Manus, Lovable, Perplexity, Google, Gemini, Pinterest, LinkedIn, Notion, Canva, CapCut, OBS, IE/Milestone, Radar; WhatsApp/YouTube já abrem) e, no ideal, abrir “quase tudo” (avaliar segurança).
2. **Canais de notícia** — ex.: “CNN” → abrir transmissão ao vivo no YouTube (não só RSS G1/UOL/BBC).
3. **App web vs browser** — “aplicativo web” = app/PWA instalado no PC; pedido normal = browser. Radar hoje abre janela errada / link incorreto.
4. **MCP** — dados OK + skills para acessar o MCP.
5. **Google** (e-mail, Docs, Agenda marcar/desmarcar) — desejo explícito.

### Apontamentos Fred — 2026-03

1. **Orquestrador melhor** — MCP/tools de dados mais eficientes, completos, **menor custo de token** (menos “reflexão” do modelo).
2. **Artefatos HTML** — visual bem mais premium; textos completos com poder sintético.
3. **Tela inicial (Start)** — config rica: nome da IA, como a IA chama a pessoa, toggles do que pode acessar/abrir nos pacotes.
4. **Credenciais** — hoje confuso; ideal: VPS + token → baixar config/secrets de banco (ou equivalente) automaticamente.
5. **Fontes de notícia** — selecionáveis; usuário inclui link de portal local → vira tool liga/desliga na tela.
6. **Vozes** — mais Voice IDs; escolha + **preview** antes de salvar (Fred busca IDs).
7. **Pasta vigiada** — melhorar picker; dúvida Drive público (ver resposta abaixo).
8. **Install Mac/Win** — pastas **separadas, organizadas e 100% funcionais**.

### Evidência no código (allowlist atual)

`packages/agent/src/desktop.ts`: hosts URL muito curtos (YouTube, Spotify, G1, UOL, BBC, WhatsApp Web, Slack, Notion, Discord + host do Radar + MCP). Apps: chrome, spotify, slack, notion, whatsapp, etc. — **sem** ChatGPT/Claude/Canva/CapCut/OBS/LinkedIn. Radar = `openUrl(radarUrl)` no browser, não app instalado. Notícias: só RSS em `news.ts` (G1/UOL/BBC).

### Resposta — Google Drive “pasta pública”

| Abordagem | Precisa OAuth Google? | Encaixa no Airy hoje |
|---|---|---|
| Pasta sincronizada pelo **Google Drive for Desktop** → path local na pasta vigiada | Não (no Airy); o sync é do cliente Google | **Sim — recomendado na Onda 1/2** |
| Link “qualquer pessoa com o link” só na nuvem, sem sync local | Na prática **sim** (API key limitada ou OAuth); link público sozinho é frágil p/ listar/baixar estável | Depois |
| Watch direto na API Drive | Sim (OAuth usuário ou service account) | Mesma onda do Gmail/Docs/Agenda |

**Conclusão:** para “inserir pasta do Drive” sem dor agora → sincronizar no PC e apontar o path local. Acesso cloud nativo entra junto com Google Agenda/Docs/Mail.

### Recorte proposto — Onda 1 com impacto (fechado para validar)

**Onda 1 — “Liga e usa” + dores do Ary que quebram confiança**

| # | Entrega | Por quê |
|---|---|---|
| 1.1 | `install/mac` + `install/win` separados, funcionais + app/ícone sem terminal | Sucesso já acordado |
| 1.1b | **Bootstrap de credenciais por token (VPS)** → grava no cofre local; fallback manual permanece. Sem painel admin multi-tenant | Dor #1 do Ary; desbloqueia “ligar e usar” |
| 1.2 | Pacote de URLs/apps pré-autorizados (lista Ary) + toggles na Start/Ajustes; **não** “abrir tudo” sem freio | Impacto imediato; segurança = lista + toggle, não allow-all cego |
| 1.3 | Distinção **app web instalado vs browser**; Radar usa URL correta da config / app se marcado | Dor #1 do relato Radar |
| 1.4 | Start mínimo: nome da IA, nome da pessoa, toggles dos pacotes, keys menos confusas (ainda local; VPS depois) | Base da tela que você descreveu |
| 1.5 | Voz: select + preview antes de salvar | Personalização rápida |
| 1.6 | Notícias: fontes selecionáveis + atalho tipo “CNN → YouTube live” (mapa canal→URL) | Ary #2 + Fred #5 |
| 1.7 | MCP estável + skill no prompt (sem redesign grande do orquestrador) | Ary #4 |

**Onda 2 — cérebro + craft**

- Orquestrador (menos tokens, tools de dados mais diretas)
- Artefatos HTML premium
- Evolução do provisionamento de credenciais (além do token magro da 1.1b)
- Fontes RSS custom (portal local) liga/desliga
- Pasta vigiada UX + doc Drive sync
- Persona default genérica (não gabinete)

**Onda 3 — canal Google / gerencial**

- OAuth Google: Agenda (CRUD), Gmail, Docs (escopo mínimo)
- Catálogo de soluções acionáveis (IE Milestone, etc.) como pacotes

**Explicitamente fora da Onda 1:** abrir qualquer URL sem allowlist; OAuth Google completo; billing; store.
