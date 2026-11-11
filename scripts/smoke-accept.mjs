/**
 * Smoke de aceite MVP + P2 (sem Electron).
 * Uso: npm run smoke:accept
 * Abre apps só se SMOKE_OPEN=1
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) config({ path: envPath });

const agentMod = await import(
  pathToFileURL(resolve("packages/agent/dist/index.js")).href
);
const { AiryAgent, loadEnvFromProcess, loadPersona, openYoutube } = agentMod;

const results = [];
function ok(name, detail = "") {
  results.push({ name, pass: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail) {
  results.push({ name, pass: false, detail });
  console.error(`FAIL  ${name} — ${detail}`);
}

// 1) Persona editável
const persona = loadPersona(process.env.AIRY_PERSONA_PATH || "");
if (persona.text.includes("Airy") && persona.path !== "(builtin)") {
  ok("persona", persona.path.replace(/\\/g, "/").split("/").slice(-2).join("/"));
} else {
  fail("persona", `path=${persona.path}`);
}

// 2) Boot agente + MCP
const env = loadEnvFromProcess();
const missing = [];
if (!env.openrouterApiKey) missing.push("OPENROUTER_API_KEY");
if (!env.elevenApiKey) missing.push("ELEVENLABS_API_KEY");
if (!env.elevenVoiceId) missing.push("ELEVENLABS_VOICE_ID");
if (!env.mcpToken) missing.push("MCP_TOKEN");
if (missing.length) {
  fail("env", `faltando ${missing.join(", ")}`);
  console.error("\nPreencha o .env e rode de novo.");
  process.exit(1);
}

const agent = new AiryAgent(env);
try {
  await agent.ready();
  ok("mcp_ready", `persona=${agent.getPersonaPath().split(/[/\\\\]/).slice(-1)[0]} model=${env.openrouterModel}`);
} catch (e) {
  fail("mcp_ready", e.message);
  process.exit(1);
}

// 3) CABS (critério de aceite)
try {
  const turn = await agent.handleText("O que é a CABS em Ribeirão Preto e qual o telefone?");
  const t = (turn.assistantText || "").toLowerCase();
  const hasAddr =
    t.includes("prudente") || t.includes("457") || t.includes("3605");
  const usedMcp = turn.toolTrace.some((x) => x.startsWith("mun_"));
  if (hasAddr && usedMcp) {
    ok(
      "cabs",
      `tools=${turn.toolTrace.join(">")} audio=${turn.audioMp3?.length || 0}B`,
    );
  } else {
    fail(
      "cabs",
      `addr=${hasAddr} mcp=${usedMcp} tools=${turn.toolTrace.join(",")} text=${turn.assistantText.slice(0, 180)}`,
    );
  }
  if ((turn.audioMp3?.length || 0) > 1000) ok("tts", `${turn.audioMp3.length} bytes`);
  else fail("tts", `audio curto ou ausente (${turn.audioMp3?.length || 0})`);
} catch (e) {
  fail("cabs", e.message);
}

// 4) Desktop (allowlist / open) — opcional
if (process.env.SMOKE_OPEN === "1") {
  try {
    const msg = await openYoutube();
    ok("open_youtube", msg);
  } catch (e) {
    fail("open_youtube", e.message);
  }
} else {
  ok("open_youtube", "skipped (SMOKE_OPEN=1 para abrir de verdade)");
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks OK`);
process.exit(failed.length ? 1 : 0);
