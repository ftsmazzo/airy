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
    text: "Você é Airy, assessor de voz PT-BR. Respostas curtas. Não invente dados.",
  };
}

export function buildSystemPrompt(personaMd: string, skillMd: string): string {
  return `Você é o **Airy**, assistente de voz do gabinete (PT-BR).

## Persona (arquivo editável — prioridade de tom e estilo)

${personaMd}

## Missão operacional
Municiar o usuário com dados do MCP **ie-dados** e executar só ações desktop simples
(abrir Radar Municipal, YouTube, Spotify, URLs allowlist).

## Desktop (mínimo)
- open_radar_municipal, open_youtube, open_spotify, open_url (allowlist).
- Não leia arquivos. Não execute comandos genéricos.

## Skill MCP ie-dados (obrigatório seguir)

${skillMd}
`;
}
