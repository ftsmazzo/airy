/** Extrai nome próprio de fala casual em PT-BR. */

const COMMANDISH =
  /\b(abre|abrir|liga|ligar|mostra|mostrar|busca|buscar|pesquisa|quanto|qual|onde|como|o\s+que|radar|youtube|spotify|cabs|pib|voto|votos|desliga|para|chega)\b/i;

const SKIP = new Set([
  "eu",
  "sou",
  "o",
  "a",
  "me",
  "chamo",
  "nome",
  "é",
  "e",
  "de",
  "para",
  "voce",
  "você",
  "meu",
  "minha",
  "se",
  "chamar",
  "pode",
  "por",
  "favor",
]);

export function parseOwnerName(utterance: string): string | null {
  let t = (utterance || "")
    .replace(/["'«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;

  // comando / pergunta → não é nome
  if (COMMANDISH.test(t) && !/\b(chamo|nome|sou)\b/i.test(t)) return null;

  t = t
    .replace(
      /^(eu\s+)?(me\s+)?(chamo|sou|o\s+meu\s+nome\s+[ée]|meu\s+nome\s+[ée]|pode\s+me\s+chamar\s+de)\s+/i,
      "",
    )
    .replace(/^(oi|ol[aá]|bom\s+dia|boa\s+tarde|boa\s+noite)[,!]?\s*/i, "")
    .replace(/\b(por\s+favor|obrigad[oa]|airy)\b/gi, "")
    .replace(/[.,!?]+$/g, "")
    .trim();

  const parts = t.split(/\s+/).filter(Boolean);
  if (!parts.length) return null;

  const nameParts: string[] = [];
  for (const p of parts) {
    const low = p.toLowerCase();
    if (SKIP.has(low)) continue;
    if (!/^[\p{L}''-]+$/u.test(p)) continue;
    if (p.length < 2) continue;
    nameParts.push(p);
    if (nameParts.length >= 2) break;
  }

  if (!nameParts.length) return null;
  // um único token muito genérico
  if (nameParts.length === 1 && nameParts[0].length < 3) return null;

  return nameParts
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
