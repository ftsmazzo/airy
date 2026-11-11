/** Detecção de intenções de sessão (acordar / dormir) por texto STT. */

const STOP_RE =
  /\b(para|pare|parar|chega|desliga|desligar|cancela|cancelar|sil[eê]ncio|dorme|dormir|pode parar|n[aã]o precisa|deixa pra l[aá])\b/i;

const STOP_WITH_NAME_RE =
  /\b(airy\s*,?\s*)?(para|pare|chega|desliga|dorme|cancela)\b|\b(para|pare|chega|desliga)\s*,?\s*airy\b/i;

const GREETING_RE =
  /\b(bom dia|boa tarde|boa noite|oi|ol[aá]|e a[ií]|fala)\b/i;

export function isStopIntent(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  // frase curta de cancelamento
  if (t.length < 48 && (STOP_RE.test(t) || STOP_WITH_NAME_RE.test(t))) return true;
  if (/^(airy\s*[,.]?\s*)?(para|chega|desliga|dorme)[!?.]*$/i.test(t)) return true;
  return false;
}

export function isGreetingIntent(text: string): boolean {
  return GREETING_RE.test(text || "");
}

export function stopAck(ownerName?: string): string {
  const name = (ownerName || "").trim();
  if (name && Math.random() > 0.45) return `Ok, ${name}. Fico por aqui.`;
  if (name) return `Parei, ${name}.`;
  return "Ok, parei.";
}

export function wakeAck(ownerName?: string): string {
  const name = (ownerName || "").trim();
  if (!name) return "Estou ouvindo.";
  const opts = [`Pode falar, ${name}.`, `Oi, ${name}.`, `${name}?`];
  return opts[Math.floor(Math.random() * opts.length)];
}
