import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, normalize, resolve, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { friendlyApiError } from "./keys.js";

const execFileAsync = promisify(execFile);

export type PdfConfig = {
  openrouterApiKey: string;
  openrouterModel: string;
};

export const PDF_TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "open_pdf",
      description:
        "Abre um PDF local no visualizador padrão. path absoluto ou relativo à pasta do usuário.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Caminho do arquivo .pdf" },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "summarize_pdf",
      description:
        "Lê um PDF local, extrai texto e devolve resumo curto (voz). Bom para briefs e documentos.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          focus: {
            type: "string",
            description: "Opcional: o que destacar no resumo",
          },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
];

/** Só permite arquivos sob home do usuário (ou path absoluto ainda dentro de home). */
export function resolveSafeUserPath(raw: string): string {
  const home = resolve(homedir());
  let p = (raw || "").trim().replace(/^["']|["']$/g, "");
  if (!p) throw new Error("Caminho vazio.");
  if (p.startsWith("~/") || p.startsWith("~\\")) {
    p = joinHome(p.slice(2));
  } else if (!isAbsolute(p)) {
    p = resolve(home, p);
  } else {
    p = resolve(normalize(p));
  }
  const rel = p.startsWith(home + sep) || p === home;
  if (!rel) {
    throw new Error("Por segurança, só abro arquivos dentro da sua pasta de usuário.");
  }
  return p;
}

function joinHome(...parts: string[]) {
  return resolve(homedir(), ...parts);
}

async function openLocalFile(filePath: string): Promise<void> {
  if (process.platform === "darwin") {
    await execFileAsync("open", [filePath]);
  } else if (process.platform === "win32") {
    await execFileAsync("cmd", ["/c", "start", "", filePath]);
  } else {
    await execFileAsync("xdg-open", [filePath]);
  }
}

export async function openPdf(pathArg: string): Promise<string> {
  const file = resolveSafeUserPath(pathArg);
  await access(file);
  if (!file.toLowerCase().endsWith(".pdf")) {
    return "O arquivo não parece PDF.";
  }
  await openLocalFile(file);
  return `PDF aberto: ${file}`;
}

async function extractPdfText(file: string): Promise<string> {
  // 1) pdftotext se existir (Poppler)
  try {
    const { stdout } = await execFileAsync("pdftotext", ["-layout", "-q", file, "-"], {
      maxBuffer: 8 * 1024 * 1024,
    });
    if (stdout?.trim()) return stdout;
  } catch {
    /* fallback */
  }

  // 2) pdf-parse (npm)
  try {
    const mod = await import("pdf-parse");
    const pdfParse = (mod as { default?: (b: Buffer) => Promise<{ text: string }> }).default ||
      (mod as unknown as (b: Buffer) => Promise<{ text: string }>);
    const buf = await readFile(file);
    const out = await pdfParse(buf);
    return out.text || "";
  } catch (e) {
    throw new Error(
      `Não consegui extrair texto do PDF (${(e as Error).message}). Instale Poppler (pdftotext) ou use PDF com texto selecionável.`,
    );
  }
}

export async function summarizePdf(
  pathArg: string,
  cfg: PdfConfig,
  focus?: string,
): Promise<string> {
  const file = resolveSafeUserPath(pathArg);
  await access(file);
  const raw = await extractPdfText(file);
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || text.length < 40) {
    return "PDF sem texto extraível (pode ser só imagem/scan). Abra e peça OCR depois, ou use um PDF com texto.";
  }

  const clipped = text.slice(0, 14000);
  const focusLine = focus?.trim()
    ? `Foque em: ${focus.trim()}.`
    : "Foque no essencial para decisão.";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.openrouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://airy.local",
      "X-Title": "Airy PDF",
    },
    body: JSON.stringify({
      model: cfg.openrouterModel || "anthropic/claude-haiku-5.5",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Resuma o documento em português, no máximo 2 frases e 45 palavras, para o assistente de voz Airy. Sem markdown.",
        },
        {
          role: "user",
          content: `${focusLine}\n\nDocumento:\n${clipped}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(friendlyApiError("OpenRouter PDF", res.status, body));
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const summary = (data.choices?.[0]?.message?.content || "").trim();
  return summary || "Não consegui resumir o PDF.";
}
