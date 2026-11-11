import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export type MemoryItem = {
  id: string;
  text: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type MemoryFile = { version: 1; items: MemoryItem[] };

const MAX_ITEMS = 80;

function memoryPath(): string {
  return join(homedir(), "Airy", "memory.json");
}

function readAll(): MemoryItem[] {
  const p = memoryPath();
  if (!existsSync(p)) return [];
  try {
    const data = JSON.parse(readFileSync(p, "utf8")) as MemoryFile;
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

function writeAll(items: MemoryItem[]): void {
  const p = memoryPath();
  mkdirSync(dirname(p), { recursive: true });
  const trimmed = items.slice(-MAX_ITEMS);
  const file: MemoryFile = { version: 1, items: trimmed };
  writeFileSync(p, JSON.stringify(file, null, 2), "utf8");
}

function slugId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function rememberFact(text: string, tags: string[] = []): string {
  const body = (text || "").trim();
  if (!body) return "Nada para lembrar.";
  const now = new Date().toISOString();
  const items = readAll();
  const item: MemoryItem = {
    id: slugId(),
    text: body.slice(0, 500),
    tags: tags.map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8),
    createdAt: now,
    updatedAt: now,
  };
  items.push(item);
  writeAll(items);
  return `Lembrei: ${item.text}`;
}

export function recallMemory(query = "", limit = 8): string {
  const items = readAll();
  if (!items.length) return "Memória vazia.";
  const q = (query || "").trim().toLowerCase();
  const scored = items
    .map((it) => {
      if (!q) return { it, score: 1 };
      const hay = `${it.text} ${it.tags.join(" ")}`.toLowerCase();
      let score = 0;
      for (const part of q.split(/\s+/)) {
        if (part.length > 1 && hay.includes(part)) score += 1;
      }
      return { it, score };
    })
    .filter((x) => (q ? x.score > 0 : true))
    .sort((a, b) => b.score - a.score || b.it.updatedAt.localeCompare(a.it.updatedAt))
    .slice(0, Math.min(20, Math.max(1, limit)));

  if (!scored.length) return `Nada na memória sobre “${query}”.`;
  return scored
    .map((x, i) => `${i + 1}. [${x.it.id}] ${x.it.text}`)
    .join("\n");
}

export function forgetMemory(queryOrId: string): string {
  const q = (queryOrId || "").trim();
  if (!q) return "Diga o id ou um trecho para esquecer.";
  const items = readAll();
  const before = items.length;
  const lower = q.toLowerCase();
  const next = items.filter((it) => {
    if (it.id === q) return false;
    if (it.text.toLowerCase().includes(lower)) return false;
    return true;
  });
  if (next.length === before) return `Não achei “${q}” na memória.`;
  writeAll(next);
  return `Esqueci ${before - next.length} item(ns).`;
}

/** Bloco curto para o system prompt. */
export function memoryPromptBlock(limit = 12): string {
  const items = readAll().slice(-limit);
  if (!items.length) return "";
  const lines = items.map((it) => `- ${it.text}`).join("\n");
  return `\n## Memória local (assistente pessoal)\nUse só se for relevante. Não invente memórias.\n${lines}\n`;
}

export const MEMORY_TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "remember_fact",
      description:
        "Guarda um fato/preferência na memória local do PC (não vai pra nuvem). Ex.: prioridade, nome, lembrete.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["text"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "recall_memory",
      description: "Consulta a memória local. query opcional para filtrar.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "forget_memory",
      description: "Remove itens da memória por id ou trecho do texto.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];
