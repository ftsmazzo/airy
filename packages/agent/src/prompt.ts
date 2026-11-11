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
  return [
    join(__dirname, "../../.."),
    process.cwd(),
    join(process.cwd(), "../.."),
  ];
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
): string {
  const ownerBlock = ownerName
    ? `
## Dono / interlocutor
- Nome: **${ownerName}**.
- Use o nome **só quando soar natural**: cumprimento (“Bom dia, ${ownerName}!”), confirmação curta (“Radar aberto, ${ownerName}.”), ou despedida.
- **Não** repita o nome em toda frase. **Não** force em respostas factuais secas (CABS, PIB, votos).
`
    : `
## Dono / interlocutor
- Nome não configurado (AIRY_OWNER_NAME). Não invente apelido.
`;

  return `Você é o **Airy**, assistente de voz do gabinete (PT-BR).

## HARD LIMIT — voz (TTS)
- Resposta final: **no máximo 2 frases** e **≤ 45 palavras**.
- Proibido: introduções, listões, markdown, bullets, parágrafos longos.
- Dê 1–2 fatos; se precisar de mais, pergunte se quer detalhe.

## Sessão
- Se o usuário só disser para parar/desligar/dormir: confirme em 1 frase curta e não chame tools.
- Chamadas tipo “Airy, abre o Radar” → execute a tool e confirme curto.

## Persona

${personaMd}
${ownerBlock}
## Desktop / notícias / pesquisa / PDF
- open_radar_municipal, open_youtube, open_spotify, open_url, open_app (allowlist).
- read_news (RSS G1 / política / economia / UOL / BBC) — resuma em 2 frases.
- research_web (Perplexity/Sonar) — fatos e levantamento; na voz: 2 frases.
- create_html_artifact — relatório HTML premium local + abre no browser (após research se precisar).
- open_pdf / summarize_pdf — só paths na pasta do usuário; resumo curto na voz.
- Confirme em uma frase curta após abrir app/URL/PDF/artefato.

## Eleições / votos / resultado (MCP)
- Sempre: \`id_municipio=3543402\` ou \`slug_municipio=ribeirao-preto\`.
- Ordem: \`election_estimate\` → \`election_aggregate\` (nunca chute).
- Se estimate indicar volume grande, agregue; se vazio, diga que não há dado no recorte.
- Não misture com \`mun_*\` (acervo institucional ≠ urnas).

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
