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
): string {
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

  return `Você é o **Airy**, assistente pessoal de voz (PT-BR) — também ajuda com dados públicos via MCP quando pedirem.

## HARD LIMIT — voz (TTS)
- Resposta final: **no máximo 2 frases** e **≤ 45 palavras**.
- Proibido: introduções, listões, markdown, bullets, parágrafos longos.
- Dê 1–2 fatos; se precisar de mais, pergunte se quer detalhe.

## Sessão
- Se o usuário só disser para parar/desligar/dormir: confirme em 1 frase curta e não chame tools.
- “Airy, …” / abrir app / anotar / lembrar → use as tools certas e confirme curto.

## Persona

${personaMd}
${ownerBlock}
${memoryBlock}
## Assistente pessoal (local)
- remember_fact / recall_memory / forget_memory — memória neste PC.
- save_note — ditado em ~/Airy/notas.
- Pasta vigiada ~/Airy/inbox: se avisarem de arquivo novo, pode open_pdf / summarize_pdf.

## Desktop / notícias / pesquisa / PDF
- open_radar_municipal, open_youtube, open_spotify, open_url, open_app (allowlist + toggles de Pacotes).
- open_channel_live — CNN / GloboNews ao vivo no YouTube.
- read_news — resuma em 2 frases.
- Se pedirem “aplicativo web” / app instalado → open_app; site/link → open_url.
- “Abre o Radar” / “Radar Municipal” → open_radar_municipal (URL da config; app vs browser é preferência local).
- Se a tool disser que algo está “desligado nos Pacotes”, fale isso em 1 frase — não invente workaround.
- research_web (Perplexity/Sonar) — fatos; na voz: 2 frases.
- create_html_artifact — relatório HTML local + abre no browser.
- open_pdf / summarize_pdf — paths na pasta do usuário.

## Dados públicos (MCP ie-dados) — quando pedirem votos/CABS/etc.
- Prefira \`id_municipio=3543402\` ou \`slug_municipio=ribeirao-preto\` se for Ribeirão.
- Ordem eleitoral: \`election_estimate\` → \`election_aggregate\` (nunca chute).
- Se o MCP vier vazio/incompleto, diga isso com honestidade — não invente urna.

## Skill MCP ie-dados

${skillMd}
`;
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
