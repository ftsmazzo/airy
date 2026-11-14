import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const execFileAsync = promisify(execFile);

export const NOTES_TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "save_note",
      description:
        "Salva um ditado/nota em ~/Airy/notas (Markdown). Se openInEditor=true, abre no Bloco de notas / TextEdit.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título curto opcional" },
          body: { type: "string", description: "Conteúdo da nota" },
          openInEditor: {
            type: "boolean",
            description: "Abrir no editor nativo depois de salvar",
          },
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

export async function saveNote(
  title: string,
  body: string,
  openInEditor = false,
): Promise<string> {
  const text = (body || "").trim();
  if (!text) return "Nota vazia.";
  const dir = join(homedir(), "Airy", "notas");
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const head = (title || "").trim() || text.slice(0, 40);
  const file = join(dir, `${stamp}-${slug(head)}.md`);
  const md = `# ${head}\n\n_Salvo por Airy · ${new Date().toLocaleString("pt-BR")}_\n\n${text}\n`;
  await writeFile(file, md, "utf8");
  if (openInEditor) {
    try {
      if (process.platform === "win32") {
        await execFileAsync("cmd", ["/c", "start", "", "notepad", file]);
      } else if (process.platform === "darwin") {
        await execFileAsync("open", ["-t", file]);
      } else {
        await execFileAsync("xdg-open", [file]);
      }
      return `Nota salva e aberta no editor: ${file}`;
    } catch {
      return `Nota salva: ${file} (não consegui abrir o editor)`;
    }
  }
  return `Nota salva: ${file}`;
}
