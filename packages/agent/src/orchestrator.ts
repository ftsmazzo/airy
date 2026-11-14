/**
 * Orquestrador em camadas:
 * - router (barato): escolhe tools e confirmações simples
 * - synthesis (mais capaz): sintetiza quando houve pesquisa/MCP/artefato/PDF
 *
 * Eficiência ≠ só preço: menos idas ao modelo forte; forte só na ponta que precisa.
 */

const SIMPLE_TOOLS = new Set([
  "open_radar_municipal",
  "open_youtube",
  "open_spotify",
  "spotify_play",
  "open_url",
  "open_app",
  "open_pdf",
  "open_channel_live",
  "remember_fact",
  "forget_memory",
  "save_note",
  "session_stop",
]);

const SYNTHESIS_TOOLS = new Set([
  "research_web",
  "create_html_artifact",
  "summarize_pdf",
  "read_news",
  "recall_memory",
]);

export const DEFAULT_ROUTER_MODEL = "anthropic/claude-haiku-5.5";
/** Ponta final mais capaz — síntese / fatos / artefato */
export const DEFAULT_SYNTHESIS_MODEL = "anthropic/claude-sonnet-4.5";

/** Precisa de modelo mais capaz na resposta falada. */
export function needsSynthesis(toolTrace: string[]): boolean {
  for (const t of toolTrace) {
    if (t === "tts_error") continue;
    if (SIMPLE_TOOLS.has(t)) continue;
    if (SYNTHESIS_TOOLS.has(t)) return true;
    if (t.startsWith("mcp__")) return true;
    // tool MCP legado / outra tool → síntese
    return true;
  }
  return false;
}

/** Só abriu app/URL / memorizou — confirmação local, sem 2º LLM. */
export function isSimpleOpenTrace(toolTrace: string[]): boolean {
  if (!toolTrace.length) return false;
  return toolTrace.every((t) => SIMPLE_TOOLS.has(t) || t === "tts_error");
}

export function synthesisUserNudge(): string {
  return [
    "Com base nas tools acima, responda em PT-BR para voz:",
    "- no máximo 2 frases curtas (≤ 45 palavras);",
    "- cite 1–2 fatos principais se houver pesquisa/dados;",
    "- se gerou artefato/HTML, confirme que abriu e o tema em 1 frase;",
    "- sem markdown, sem bullets, sem tools.",
  ].join(" ");
}
