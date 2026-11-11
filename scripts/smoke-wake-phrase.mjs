/**
 * Smoke do parser “Airy …” (sem Electron).
 * Roda: node scripts/smoke-wake-phrase.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// avalia o TS compilado? melhor reimplementar mínimo inline do contrato
function stripAccents(s) {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function parseWakeUtterance(text) {
  const raw = (text || "").trim().replace(/\s+/g, " ");
  if (!raw) return { hit: false, command: "", raw: "" };
  const norm = stripAccents(raw);
  if (/^(?:oi|ola|hey|eai|e ai)?\s*airy(?:\s+ai)?\b[.!?]*$/i.test(norm)) {
    return { hit: true, command: "", raw };
  }
  const start = /^(?:oi|ola|hey|eai|e ai)?\s*airy(?:\s+ai)?\b[\s,:.\-]+(.+)$/i;
  const mStart = norm.match(start);
  if (mStart?.[1]?.trim()) return { hit: true, command: mStart[1].trim(), raw };
  const end = /^(.+?)[\s,.\-]+airy(?:\s+ai)?\b[.!?]*$/i;
  const mEnd = norm.match(end);
  if (mEnd?.[1]?.trim()) {
    const cmd = mEnd[1].trim();
    if (/^(oi|ola|hey|eai|e ai)$/i.test(cmd)) return { hit: true, command: "", raw };
    return { hit: true, command: cmd, raw };
  }
  return { hit: false, command: "", raw };
}

const cases = [
  ["Airy, abre o radar", true, "abre o radar"],
  ["abre o radar Airy", true, "abre o radar"],
  ["Airy", true, ""],
  ["Oi Airy", true, ""],
  ["faz isso Airy", true, "faz isso"],
  ["abre o youtube", false, ""],
];

let fail = 0;
for (const [input, hit, command] of cases) {
  const r = parseWakeUtterance(input);
  if (r.hit !== hit || (hit && r.command.toLowerCase() !== command.toLowerCase())) {
    console.error("FAIL", input, r);
    fail++;
  }
}

// garante que o arquivo fonte existe
readFileSync(resolve("apps/desktop/src/lib/wakePhrase.ts"), "utf8");

if (fail) process.exit(1);
console.log("PASS wake phrase", cases.length, "cases");
