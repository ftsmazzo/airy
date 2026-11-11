/**
 * Valida ambiente Airy antes do teste no Mac.
 * Não imprime secrets.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) config({ path: envPath });

const required = [
  "OPENROUTER_API_KEY",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID",
  "MCP_TOKEN",
];
const optional = [
  "OPENROUTER_MODEL",
  "ELEVENLABS_MODEL_ID",
  "AIRY_RADAR_URL",
  "MCP_BASE_URL",
  "AIRY_PERSONA_PATH",
];

let failed = 0;

function clean(v) {
  return (v || "").trim().replace(/^["']|["']$/g, "");
}

console.log(`Node ${process.version} | ${process.platform}/${process.arch}`);
console.log(`.env: ${existsSync(envPath) ? "ok" : "AUSENTE"}`);

for (const k of required) {
  const v = clean(process.env[k]);
  if (!v || v.includes("...") || v.length < 8) {
    console.error(`FAIL  ${k} (ausente ou placeholder)`);
    failed++;
  } else {
    console.log(`PASS  ${k} (len=${v.length})`);
  }
}

for (const k of optional) {
  const v = clean(process.env[k]);
  console.log(v ? `OK    ${k}` : `—     ${k} (opcional / default)`);
}

const base =
  clean(process.env.MCP_BASE_URL) ||
  "https://ie-dados-mcp.kxryyk.easypanel.host";
const token = clean(process.env.MCP_TOKEN);

if (token && token.length >= 8) {
  try {
    const health = await fetch(`${base}/health`);
    const body = await health.text();
    if (health.ok && /ok/i.test(body)) console.log("PASS  MCP /health");
    else {
      console.error(`FAIL  MCP /health ${health.status} ${body.slice(0, 80)}`);
      failed++;
    }

    const mcpUrl = `${base}/key/${token}/mcp`;
    const init = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "airy-doctor", version: "0.1.0" },
        },
      }),
    });
    if (init.status === 401) {
      console.error("FAIL  MCP token inválido (401)");
      failed++;
    } else if (!init.ok) {
      console.error(`FAIL  MCP init ${init.status}`);
      failed++;
    } else {
      console.log("PASS  MCP token (initialize)");
    }
  } catch (e) {
    console.error(`FAIL  MCP rede: ${e.message}`);
    failed++;
  }
}

const persona = resolve(process.cwd(), "persona/AIRY_PERSONA.md");
console.log(existsSync(persona) ? "PASS  persona/AIRY_PERSONA.md" : "FAIL  persona ausente");

if (failed) {
  console.error(`\nDoctor: ${failed} problema(s). Preencha o .env e rode de novo.`);
  process.exit(1);
}
console.log("\nDoctor: OK — pode rodar npm run smoke:accept e npm run dev");
