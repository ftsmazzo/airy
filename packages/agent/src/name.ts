/** Extrai nome próprio de fala casual em PT-BR. */

export function parseOwnerName(utterance: string): string | null {
  let t = (utterance || "")
    .replace(/["'«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;

  t = t
    .replace(/^(eu\s+)?(me\s+)?(chamo|sou|o\s+meu\s+nome\s+[ée]|meu\s+nome\s+[ée]|pode\s+me\s+chamar\s+de)\s+/i, "")
    .replace(/^(oi|ol[aá]|bom\s+dia|boa\s+tarde|boa\s+noite)[,!]?\s*/i, "")
    .replace(/\b(por\s+favor|obrigad[oa]|airy)\b/gi, "")
    .replace(/[.,!?]+$/g, "")
    .trim();

  // pega 1–3 tokens com cara de nome
  const parts = t.split(/\s+/).filter(Boolean);
  if (!parts.length) return null;

  const skip = new Set([
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
  ]);

  const nameParts: string[] = [];
  for (const p of parts) {
    const low = p.toLowerCase();
    if (skip.has(low)) continue;
    if (!/^[\p{L}''-]+$/u.test(p)) continue;
    if (p.length < 2) continue;
    nameParts.push(p);
    if (nameParts.length >= 2) break; // "Ana Paula" ok; evita frase inteira
  }

  if (!nameParts.length) return null;

  return nameParts
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
