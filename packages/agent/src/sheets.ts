/**
 * Leitura leve de CSV / TSV (sem dependência nova).
 * XLSX completo fica para depois (precisa de lib).
 */
import { readFileSync, existsSync } from "node:fs";
import { extname } from "node:path";

export const SHEET_TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "read_spreadsheet",
      description:
        "Lê CSV/TSV local e devolve um resumo + primeiras linhas. Use para planilhas exportadas em CSV. Arquivos .xlsx: peça exportar CSV por enquanto.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Caminho absoluto do arquivo" },
          maxRows: {
            type: "number",
            description: "Máximo de linhas de amostra (default 12)",
          },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
];

function parseDelimited(text: string, delim: string): string[][] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.length);
  return lines.map((line) => {
    // CSV simples com aspas
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (ch === delim && !inQ) {
        cells.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  });
}

export function readSpreadsheet(path: string, maxRows = 12): string {
  const p = (path || "").trim().replace(/^["']|["']$/g, "");
  if (!p) return "Caminho vazio.";
  if (!existsSync(p)) return `Arquivo não encontrado: ${p}`;
  const ext = extname(p).toLowerCase();
  if (ext === ".xlsx" || ext === ".xls") {
    return "Planilha Excel (.xlsx) ainda não é lida nativamente. Exporte como CSV e peça de novo, ou salve a aba como CSV.";
  }
  if (ext !== ".csv" && ext !== ".tsv" && ext !== ".txt") {
    return `Formato não suportado (${ext || "sem extensão"}). Use CSV ou TSV.`;
  }
  let raw = "";
  try {
    raw = readFileSync(p, "utf8");
  } catch (e) {
    return `Não consegui ler: ${(e as Error).message}`;
  }
  if (raw.length > 2_000_000) {
    raw = raw.slice(0, 2_000_000);
  }
  const delim = ext === ".tsv" || raw.split("\t").length > raw.split(",").length * 1.5 ? "\t" : ",";
  const rows = parseDelimited(raw, delim);
  if (!rows.length) return "Arquivo vazio.";
  const header = rows[0] || [];
  const sample = rows.slice(0, Math.max(2, Math.min(maxRows, 30)));
  const preview = sample
    .map((r, i) => `${i === 0 ? "HDR" : String(i).padStart(3, "0")}: ${r.join(" | ")}`)
    .join("\n");
  return [
    `Planilha: ${p}`,
    `Linhas≈${rows.length} · Colunas≈${header.length} · Separador=${delim === "\t" ? "TAB" : "CSV"}`,
    `Colunas: ${header.join(", ") || "(sem cabeçalho)"}`,
    "Amostra:",
    preview,
  ].join("\n");
}
