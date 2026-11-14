/**
 * Acordar pelo nome configurável: "Airy, abre o radar" / "Abre o radar, Clara".
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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Monta padrão do nome (ex.: Airy → airy(?:\s+ai)?) */
function namePattern(assistantName: string): string {
  const n = stripAccents((assistantName || "Airy").trim() || "Airy").toLowerCase();
  const core = escapeRegExp(n);
  // legado: "Airy AI" ainda conta quando o nome é Airy
  if (n === "airy") return `${core}(?:\\s+ai)?`;
  return core;
}

export function parseWakeUtterance(
  text: string,
  assistantName = "Airy",
): WakeParse {
  const raw = (text || "").trim().replace(/\s+/g, " ");
  if (!raw) return { hit: false, command: "", raw: "" };

  const norm = stripAccents(raw);
  const name = namePattern(assistantName);

  const only = new RegExp(
    `^(?:oi|ola|hey|eai|e ai)?\\s*${name}\\b[.!?]*$`,
    "i",
  );
  if (only.test(norm)) return { hit: true, command: "", raw };

  const start = new RegExp(
    `^(?:oi|ola|hey|eai|e ai)?\\s*${name}\\b[\\s,:.\\-]+(.+)$`,
    "i",
  );
  const mStart = norm.match(start);
  if (mStart?.[1]?.trim()) {
    return { hit: true, command: mStart[1].trim(), raw };
  }

  const end = new RegExp(
    `^(.+?)[\\s,.\\-]+${name}\\b[.!?]*$`,
    "i",
  );
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
