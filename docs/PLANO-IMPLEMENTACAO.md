# Plano de Implementação — Airy

> Plano de Melhoria (Modo B). Depende de: PRD · TRD · FLUXO-APP · UIUX · ESQUEMA-BACKEND.

**Data**: 2026-03-13

## 1. MVP de produto (Onda 1) — valor testável

Usuário **não técnico** consegue:

1. Instalar via artefato Mac **ou** Windows (pastas `install/mac` e `install/win`).
2. Abrir pelo **ícone** (sem Git/Node/terminal).
3. Ativar com **token** (VPS) ou fallback de keys.
4. Falar e receber resposta.
5. Abrir sites/apps da lista Ary (toggles), Radar certo (app vs browser), notícia tipo CNN→live, voz com preview; MCP ok.

## 2. Gaps consolidados (por risco)

| Gap | Origem | Risco | Prioridade |
|---|---|---|---|
| Sem instalador real (atalho → `npm run dev`) | PRD/TRD/Fluxo | UX / adoção | P0 |
| Credenciais manuais bloqueiam (Ary) | PRD/UIUX | UX | P0 |
| Doctor desalinhado do cofre | TRD/Esquema | UX / suporte | P0 |
| Allowlist estreita / erros de permissão | PRD/Ary | UX | P0 |
| Radar URL errada / só browser | PRD/Fluxo | UX | P0 |
| Sem Start (onboarding) | Fluxo/UIUX | UX | P0 |
| Provisionador = superfície de segredos | TRD/Esquema/Segurança | Segurança | P0 |
| MCP instável / skill fraca | Ary | UX / dados | P1 |
| Sem preview de voz / knobs na UI | Fred | UX | P1 |
| Notícias rígidas (só G1/UOL/BBC) | Ary/Fred | UX | P1 |
| Persona “gabinete” no default | PRD | Produto | P2 |
| Orquestrador caro / artefatos fracos | Fred | Custo / craft | Onda 2 |
| Credenciais sem evolução ops | Fred | Ops | Onda 2 |
| Google Agenda/Mail/Docs | Ary | Feature | Onda 3 |
| Path bat hardcoded no repo | TRD | Débito | P1 |
| Code signing / notarização | TRD | Distribuição | P2 (avisar usuário) |

## 3. Fases de correção / entrega

Trabalho em **fatias pequenas**, cada uma com critério de pronto testável. Ordem = dependência + impacto.

### Onda 1 — fatias

| Fatia | Escopo | Dependência | Critério de pronto |
|---|---|---|---|
| **1.0 Fundação** | `install/mac` + `install/win` (esqueleto docs+scripts); limpar bat path de usuário; doctor lê **cofre**/settings (e `.env` só como fallback) | — | Docs de install existem; `doctor` verde com keys só no painel |
| **1.1 Packaging** | electron-builder (ou eq.) → artefato Mac + Win; atalho/ícone → binário; smoke open app | 1.0 | App abre sem `npm run dev` no PATH do usuário final |
| **1.1b Credenciais** | Serviço VPS `/health` + `/v1/redeem` + Postgres `InstallToken`; IPC `airy:redeem-token`; Start campo token → cofre; rate limit + TTL/usos; seed script (sem admin UI) | 1.0 (UI pode vir antes do builder) | Token de teste ativa máquina limpa; fallback manual ok |
| **1.2 Pacotes** | Expandir allowlist (lista Ary); `enabledPackages` no settings; toggles em Ajustes; erro falado “desligado nos Pacotes” | settings v2 | ChatGPT/Notion/… abrem se toggle on; off bloqueia |
| **1.3 App vs browser** | Routing prompt + preferência por item; Radar usa URL config; opção “abrir como app” | 1.2 | Pedido “app do Radar” ≠ “abre o Radar” no browser |
| **1.4 Start UI** | StartGate (UIUX): token CTA; nomes IA/pessoa; link keys manuais | 1.1b | Primeiro boot sem secrets mostra Start; após redeem → orbe |
| **1.5 Voz** | Catálogo (IDs que Fred passar) + Preview TTS + salvar Voice ID | Start/Ajustes | Ouviu preview antes de gravar |
| **1.6 Notícias** | Fontes ligáveis + mapa canal→URL (CNN live); RSS custom URL (mínimo) | settings | “CNN” abre live configurada; fonte local toggle |
| **1.7 MCP** | Health check no boot/doctor; skill `ie-dados` no prompt; mensagem clara se token/base falhar | 1.1b | Pedido de dado MCP responde ou explica falha sem travar |
| **1.8 Aceite** | Checklist Mac+Win (atualizar `MAC-TEST-CHECKLIST` + criar Win); teste com Ary/Fred no critério Onda 1 | 1.1–1.7 | Critério PRD Onda 1 cumprido em 2 máquinas |

**Paralelismo útil:** 1.1b (VPS) pode andar em paralelo com 1.1 (builder) e 1.2 (allowlist).

### Onda 2 — cérebro + craft

| Fatia | Escopo |
|---|---|
| 2.1 | Orquestrador 2 camadas: roteador barato + síntese forte (pesquisa/MCP/artefato) — **feito** |
| 2.1b | Skills na UI (ligar/importar .md) + multi-MCP — **feito** |
| 2.2 | Artefatos HTML premium (visual + texto sintético completo) |
| 2.3 | Persona default genérica; editar persona na UI |
| 2.4 | Pasta vigiada UX + doc “Drive sync = path local” |
| 2.5 | Ops de tokens (rota interna/script melhor); opcional export settings |
| CI | Workflow Win+Mac artifacts/release — **feito** (`.github/workflows/release-desktop.yml`) |

### Onda 3 — canal gerencial Google

| Fatia | Escopo |
|---|---|
| 3.1 | OAuth Google (escopo mínimo) Agenda CRUD |
| 3.2 | Gmail / Docs (se ainda fizer sentido) |
| 3.3 | Pacotes de soluções (IE Milestone etc.) como catálogo |

## 4. Ordem sugerida de execução (próximos passos de código)

```
1.0 doctor+install folders
    ├─► 1.2 pacotes allowlist     (ganho Ary rápido)
    ├─► 1.1b provisionador VPS
    └─► 1.1 electron-builder
         └─► 1.4 Start UI (precisa redeem)
              ├─► 1.3 app vs browser
              ├─► 1.5 voz preview
              ├─► 1.6 notícias
              └─► 1.7 MCP polish
                   └─► 1.8 aceite humano
```

## 5. Marcos externos

| Marco | Meta |
|---|---|
| Demo interna Fred | Fatias 1.0 + 1.1b + 1.2 + Start mínimo |
| Aceite Ary (reteste agência) | Packaging + token + pacotes + Radar |
| “Onda 1 fechada” | Critério PRD: install→ícone→token→voz sem terminal (Mac e Win) |
| Datas calendário | *a definir pelo Fred* |

## 6. Critério de “pronto” por onda

- **Onda 1:** checklist §1 deste doc + doctor/cofre + sem dependência de Claude para instalar.
- **Onda 2:** custo/turno menor mensurável (amostra de prompts) + artefato HTML aprovado visualmente + persona não-gabinete.
- **Onda 3:** marcar/desmarcar compromisso na Agenda por voz em conta de teste.

## 7. Segurança (gate antes de expor redeem em produção)

Antes do provisionador público na Fabrica-IA (`fabrica-seguranca`):

- [ ] HTTPS only; rate limit `/v1/redeem`
- [ ] Token hash + TTL/max_uses; sem log de secrets
- [ ] Postgres dedicado; secrets só em env EasyPanel
- [ ] Desktop grava só no `safeStorage`; limpa token da UI
- [ ] `/health` real no serviço

## 9. Progresso de implementação (2026-03-13)

| Fatia | Status |
|---|---|
| 1.0 doctor + install/mac\|win | **Feito** (doctor aceita cofre; pastas + setup) |
| 1.1b provisionador + redeem no app | **Deployed** — `https://airy-provisioner.kxryyk.easypanel.host` `/health` ok; seed via `BOOTSTRAP_TOKEN` + keys nas env EasyPanel |
| 1.2 allowlist Ary | **Feito** (catálogo + `enabledPackages` + toggles em Ajustes) |
| 1.3 app vs browser | **Feito** (Radar: preferência app/PWA vs browser + nome do app) |
| 1.4 Start UI | **Feito mínimo** (token + nomes + keys manuais colapsáveis) |
| 1.5 voz preview | **Feito** (select catálogo + Preview TTS) |
| 1.6 notícias CNN live | **Feito mínimo** (`open_channel_live`) |
| 1.7 MCP polish | **Feito** (health + soft-fail no boot; erros amigáveis; status na UI) |
| 1.8 aceite | **Checklist** Win + Mac atualizados — falta rodada humana Ary/Fred |
| 1.1 packaging electron-builder | **Win OK** — `release/Airy-Setup-0.1.0-x64.exe`; Mac DMG só em macOS; sem code signing ainda |

## 8. Fora deste plano (não puxar)

- Painel admin multi-tenant  
- Allow-all de URLs  
- App Store / Microsoft Store  
- Billing  
- OAuth Google na Onda 1  

---

## Próximo passo após fechar a documentação

Perguntar ao responsável: **começar implementação pela fatia 1.0** (doctor + pastas install) **em paralelo com 1.1b** (provisionador), ou outra ordem.
