import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readFirstExisting(paths: string[]): string | null {
  for (const p of paths) {
    try {
      if (existsSync(p)) return readFileSync(p, "utf8");
    } catch {
      /* try next */
    }
  }
  return null;
}

function repoRoots(): string[] {
  const roots = [
    join(__dirname, "../../.."),
    process.cwd(),
    join(process.cwd(), "../.."),
  ];
  // App empacotado: persona/skills em resources/ (electron-builder extraResources)
  const res = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (res) roots.unshift(res);
  return roots;
}

export function loadIeDadosSkill(): string {
  const paths = repoRoots().map((r) => join(r, "skills/ie-dados-mcp.md"));
  return (
    readFirstExisting(paths) ||
    "Use as tools MCP ie-dados tipadas. Escopo Ribeirão Preto 3543402. Não invente dados."
  );
}

/** Persona editável: AIRY_PERSONA_PATH ou persona/AIRY_PERSONA.md */
export function loadPersona(personaPath?: string): { path: string; text: string } {
  const override = personaPath || process.env.AIRY_PERSONA_PATH || "";
  const candidates = [
    ...(override ? [resolve(override)] : []),
    ...repoRoots().map((r) => join(r, "persona/AIRY_PERSONA.md")),
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) {
        return { path: p, text: readFileSync(p, "utf8") };
      }
    } catch {
      /* next */
    }
  }
  return {
    path: "(builtin)",
    text: "Você é Airy. Respostas em no máximo 2 frases curtas. Não invente dados.",
  };
}

export function buildSystemPrompt(
  personaMd: string,
  skillMd: string,
  ownerName = "",
  memoryBlock = "",
  assistantName = "Airy",
): string {
  const name = (assistantName || "Airy").trim() || "Airy";
  const ownerBlock = ownerName
    ? `
## Dono / interlocutor
- Nome: **${ownerName}**.
- Use o nome **só quando soar natural**: cumprimento (“Bom dia, ${ownerName}!”), confirmação curta (“Radar aberto, ${ownerName}.”), ou despedida.
- **Não** repita o nome em toda frase. **Não** force em respostas factuais secas.
`
    : `
## Dono / interlocutor
- Nome não configurado. Não invente apelido.
`;

  const skillsBlock = skillMd.trim()
    ? `
## Skills ativas (siga estas instruções)

${skillMd.trim()}
`
    : "";

  return `Você é **${name}**, assistente pessoal de voz (PT-BR). Pode usar tools desktop, pesquisa, artefatos e conexões MCP ativas.
Apresente-se e responda como **${name}** (não como outro produto).

## HARD LIMIT — voz (TTS)
- Resposta falada: **no máximo 2 frases** e **≤ 45 palavras**.
- Proibido na fala: introduções longas, listões, markdown, bullets.
- Artefatos/HTML e pesquisa: use as tools; na voz só confirme curto o que fez.
- Dê 1–2 fatos; se precisar de mais, pergunte se quer detalhe.

## Sessão
- Se o usuário só disser para parar/desligar/dormir: confirme em 1 frase curta e não chame tools.
- “${name}, …” / abrir app / anotar / lembrar / pesquisar → use as tools certas e confirme curto.
- Tools MCP vêm prefixadas \`mcp__<conexão>__<tool>\` — use a conexão certa para o pedido.

## Persona

${personaMd}
${ownerBlock}
${memoryBlock}
## Assistente pessoal (local)
- remember_fact / recall_memory / forget_memory — memória neste PC.
- save_note — ditado em ~/Airy/notas; openInEditor=true abre no Bloco de notas/TextEdit.
- Pasta vigiada ~/Airy/inbox: se avisarem de arquivo novo, pode open_pdf / summarize_pdf / read_spreadsheet.

## Desktop / notícias / pesquisa / PDF / planilha
- open_radar_municipal, open_youtube, open_spotify, open_url, open_app (allowlist + toggles de Pacotes).
- open_spotify: abre o **app** (URI spotify:…). Com nome → busca no app; com link → playlist.
- spotify_play: se OAuth conectado, busca e toca de verdade na conta (Premium). Prefira quando o usuário disser “toca/ouvir playlist X”.
- open_app: notepad / word / vscode / cursor para editores.
- open_channel_live — CNN / GloboNews ao vivo no YouTube.
- read_news — resuma em 2 frases.
- read_spreadsheet — CSV/TSV local (xlsx: pedir export CSV).
- Se pedirem “aplicativo web” / app instalado → open_app; site/link → open_url.
- “Abre o Radar” / “Radar Municipal” → open_radar_municipal (URL da config; app vs browser é preferência local).
- Se a tool disser que algo está “desligado nos Pacotes”, fale isso em 1 frase — não invente workaround.
- research_web (Perplexity/Sonar) — fatos; na voz: 2 frases.
- create_html_artifact — relatório HTML local + abre no browser.
- open_pdf / summarize_pdf — paths na pasta do usuário.

## MCP
- Use tools MCP quando o usuário pedir dados de sistemas conectados.
- Se MCP vier vazio/offline/token inválido, diga com honestidade — não invente dados.
${skillsBlock}`;
}

/** Corta texto longo antes do TTS (rede de segurança). */
export function clipForSpeech(text: string, maxChars = 320): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return clean;
  const sentences = clean.split(/(?<=[.!?…])\s+/).filter(Boolean);
  let out = sentences.slice(0, 2).join(" ");
  if (!out) out = clean;
  if (out.length <= maxChars) return out;
  const cut = out.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}
