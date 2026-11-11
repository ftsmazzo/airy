import { friendlyApiError } from "./keys.js";

export type ResearchConfig = {
  openrouterApiKey: string;
  /** Default: perplexity/sonar (~$1/M in+out) */
  researchModel?: string;
};

export const RESEARCH_TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "research_web",
      description:
        "Pesquisa na web via Perplexity (OpenRouter Sonar). Use para levantamento de produto, concorrência, fatos atuais. Depois resuma curto na voz; se pedirem relatório, chame create_html_artifact.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Pergunta ou tema a pesquisar (PT ou EN).",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];

/**
 * Custo aproximado (OpenRouter, mar/2026):
 * - perplexity/sonar ………… $1.00 / $1.00 por 1M tokens  ← default
 * - sonar-pro / sonar-pro-search … $3 / $15 (caro, evitar no dia a dia)
 * - Haiku 5.5 (cérebro) ……… $0.10 / $0.50
 * Uma pesquisa típica (~2–4k tokens) com Sonar: centavos de dólar.
 */
export async function researchWeb(
  query: string,
  cfg: ResearchConfig,
): Promise<string> {
  const q = (query || "").trim();
  if (!q) return "Query vazia.";
  if (!cfg.openrouterApiKey) return "OpenRouter API key ausente.";

  const model = cfg.researchModel || "perplexity/sonar";
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.openrouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://airy.local",
      "X-Title": "Airy Research",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Você é pesquisador para o assistente Airy (gabinete, PT-BR). Responda em português claro, com fatos, números e fontes quando houver. Estruture: Achados; Características; Oferta/preço se houver; Riscos/lacunas; Fontes (URLs).",
        },
        { role: "user", content: q },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(friendlyApiError("Perplexity/OpenRouter", res.status, body));
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    citations?: string[];
  };
  const text = (data.choices?.[0]?.message?.content || "").trim();
  const citations = Array.isArray(data.citations) ? data.citations : [];
  if (!text) return "Pesquisa sem resultado útil.";
  const fonteBlock =
    citations.length > 0
      ? `\n\nFontes:\n${citations.slice(0, 8).map((u) => `- ${u}`).join("\n")}`
      : "";
  return `${text}${fonteBlock}`.slice(0, 14000);
}
