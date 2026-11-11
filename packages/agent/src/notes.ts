import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export const NOTES_TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "save_note",
      description:
        "Salva um ditado/nota em ~/Airy/notas (Markdown). Use quando o usuário pedir para anotar, registrar ou ditado.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título curto opcional" },
          body: { type: "string", description: "Conteúdo da nota" },
        },
        required: ["body"],
        additionalProperties: false,
      },
    },
  },
];

function slug(s: string): string {
  return (s || "nota")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "nota";
}

export async function saveNote(title: string, body: string): Promise<string> {
  const text = (body || "").trim();
  if (!text) return "Nota vazia.";
  const dir = join(homedir(), "Airy", "notas");
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const head = (title || "").trim() || text.slice(0, 40);
  const file = join(dir, `${stamp}-${slug(head)}.md`);
  const md = `# ${head}\n\n_Salvo por Airy · ${new Date().toLocaleString("pt-BR")}_\n\n${text}\n`;
  await writeFile(file, md, "utf8");
  return `Nota salva: ${file}`;
}
