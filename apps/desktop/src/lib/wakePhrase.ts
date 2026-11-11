/**
 * Acordar pelo nome: "Airy, abre o radar" / "Abre o radar, Airy" / só "Airy".
 */

export type WakeParse = {
  hit: boolean;
  /** Comando sem o nome; vazio = só chamou, precisa ouvir o resto */
  command: string;
  raw: string;
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

export function parseWakeUtterance(text: string): WakeParse {
  const raw = (text || "").trim().replace(/\s+/g, " ");
  if (!raw) return { hit: false, command: "", raw: "" };

  const norm = stripAccents(raw);

  const only =
    /^(?:oi|ola|hey|eai|e ai)?\s*airy(?:\s+ai)?\b[.!?]*$/i;
  if (only.test(norm)) return { hit: true, command: "", raw };

  const start =
    /^(?:oi|ola|hey|eai|e ai)?\s*airy(?:\s+ai)?\b[\s,:.\-]+(.+)$/i;
  const mStart = norm.match(start);
  if (mStart?.[1]?.trim()) {
    return { hit: true, command: mStart[1].trim(), raw };
  }

  const end = /^(.+?)[\s,.\-]+airy(?:\s+ai)?\b[.!?]*$/i;
  const mEnd = norm.match(end);
  if (mEnd?.[1]?.trim()) {
    const cmd = mEnd[1].trim();
    if (/^(oi|ola|hey|eai|e ai)$/i.test(cmd)) {
      return { hit: true, command: "", raw };
    }
    return { hit: true, command: cmd, raw };
  }

  return { hit: false, command: "", raw };
}
