/** Sanitiza e valida API keys coladas do painel / .env. */

export function sanitizeSecret(raw: string | undefined): string {
  let v = (raw || "")
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/^["']|["']$/g, "");
  // colaram "Bearer sk-..."
  v = v.replace(/^Bearer\s+/i, "").trim();
  // colaram label junto
  v = v.replace(/^(OPENROUTER_API_KEY|ELEVENLABS_API_KEY|MCP_TOKEN)\s*=\s*/i, "").trim();
  return v;
}

export function looksLikeOpenRouterKey(key: string): boolean {
  return /^sk-or-v1-[A-Za-z0-9_-]{20,}$/.test(key);
}

export function looksLikeElevenKey(key: string): boolean {
  // ElevenLabs costuma ser hex longo; aceita também sk_
  return key.length >= 20 && (/^[a-f0-9]{20,}$/i.test(key) || /^sk[_-]/i.test(key));
}

export function friendlyApiError(service: string, status: number, body: string): string {
  if (status === 401 || status === 403) {
    return `${service} recusou a key (${status}). Abra Ajustes (tecla ,), cole a key de novo e Salve. Detalhe: ${body.slice(0, 120)}`;
  }
  return `${service} ${status}: ${body.slice(0, 180)}`;
}
