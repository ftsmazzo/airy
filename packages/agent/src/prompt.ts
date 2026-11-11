import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadIeDadosSkill(): string {
  const candidates = [
    join(__dirname, "../../../skills/ie-dados-mcp.md"),
    join(process.cwd(), "skills/ie-dados-mcp.md"),
  ];
  for (const p of candidates) {
    try {
      return readFileSync(p, "utf8");
    } catch {
      /* try next */
    }
  }
  return "Use as tools MCP ie-dados tipadas. Escopo Ribeirão Preto 3543402. Não invente dados.";
}

export function buildSystemPrompt(skillMd: string): string {
  return `Você é o **Airy**, assistente de voz do gabinete (PT-BR).

## Missão
Municiar o usuário com dados do MCP **ie-dados** de forma fluida e analítica, e executar só ações desktop simples (abrir Radar Municipal, YouTube, Spotify, URLs allowlist).

## Estilo falado
- Respostas **curtas** para TTS (2–5 frases), depois ofereça detalhar.
- Português do Brasil, tom de assessor confiável.
- Nunca invente telefone, endereço, nome de secretário, voto ou PIB.
- Se a tool não trouxe o fato: diga que não está no recorte P0.

## Desktop (mínimo)
- open_radar_municipal, open_youtube, open_spotify, open_url (allowlist).
- Não leia arquivos. Não execute comandos genéricos.

## Skill MCP ie-dados (obrigatório seguir)

${skillMd}
`;
}
