/**
 * Valida ambiente Airy.
 * Aceita keys no .env OU presença de secrets no cofre local (airy-secure.json).
 * Não imprime secrets.
 */
import { config } from "dotenv";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) config({ path: envPath });

const requiredEnv = [
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
  "AIRY_PROVISIONER_URL",
];

let failed = 0;

function clean(v) {
  return (v || "").trim().replace(/^["']|["']$/g, "");
}

function envOk(k) {
  const v = clean(process.env[k]);
  return Boolean(v && !v.includes("...") && v.length >= 8);
}

/** Caminhos típicos do userData Electron (nome do app pode variar). */
function findVaultCandidates() {
  const home = homedir();
  const names = ["airy", "Airy", "@airy-desktop", "airy-desktop"];
  const bases = [];
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || join(home, "AppData", "Roaming");
    for (const n of names) bases.push(join(appData, n));
  } else if (process.platform === "darwin") {
    for (const n of names) bases.push(join(home, "Library", "Application Support", n));
  } else {
    for (const n of names) bases.push(join(home, ".config", n));
  }
  // também varre pastas cujo nome contém airy
  try {
    const root =
      process.platform === "win32"
        ? process.env.APPDATA || join(home, "AppData", "Roaming")
        : process.platform === "darwin"
          ? join(home, "Library", "Application Support")
          : join(home, ".config");
    for (const ent of readdirSync(root, { withFileTypes: true })) {
      if (ent.isDirectory() && /airy/i.test(ent.name)) {
        bases.push(join(root, ent.name));
      }
    }
  } catch {
    /* ignore */
  }
  return [...new Set(bases)].map((b) => join(b, "airy-secure.json"));
}

/**
 * Sem safeStorage não descriptografamos — só verificamos se há blobs de secret.
 * @returns {{ found: boolean, path: string | null, secretSlots: number, hasVoiceId: boolean, ownerName: string }}
 */
function inspectVault() {
  for (const p of findVaultCandidates()) {
    if (!existsSync(p)) continue;
    try {
      const data = JSON.parse(readFileSync(p, "utf8"));
      const secrets = data?.secrets || {};
      let secretSlots = 0;
      for (const k of ["openrouterApiKey", "elevenApiKey", "mcpToken"]) {
        if (typeof secrets[k] === "string" && secrets[k].length > 4) secretSlots++;
      }
      const pub = data?.public || {};
      return {
        found: true,
        path: p,
        secretSlots,
        hasVoiceId: Boolean(clean(pub.elevenVoiceId)),
        ownerName: clean(pub.ownerName),
      };
    } catch {
      return { found: true, path: p, secretSlots: 0, hasVoiceId: false, ownerName: "" };
    }
  }
  return { found: false, path: null, secretSlots: 0, hasVoiceId: false, ownerName: "" };
}

console.log(`Node ${process.version} | ${process.platform}/${process.arch}`);
console.log(`.env: ${existsSync(envPath) ? "ok" : "ausente (ok se usou o painel/token)"}`);

const vault = inspectVault();
if (vault.found) {
  console.log(
    `PASS  cofre local (${vault.secretSlots}/3 secrets) @ ${vault.path}`,
  );
  if (vault.hasVoiceId) console.log("PASS  cofre: elevenVoiceId");
  else console.log("—     cofre: elevenVoiceId (configure no app)");
  if (vault.ownerName) console.log(`OK    ownerName=${vault.ownerName}`);
} else {
  console.log("—     cofre local ainda não criado (abra o app ou cole token/keys)");
}

const fromEnv = {
  OPENROUTER_API_KEY: envOk("OPENROUTER_API_KEY"),
  ELEVENLABS_API_KEY: envOk("ELEVENLABS_API_KEY"),
  ELEVENLABS_VOICE_ID: envOk("ELEVENLABS_VOICE_ID"),
  MCP_TOKEN: envOk("MCP_TOKEN"),
};

for (const k of requiredEnv) {
  if (fromEnv[k]) console.log(`PASS  .env ${k}`);
  else console.log(`—     .env ${k}`);
}

const credsOk =
  (fromEnv.OPENROUTER_API_KEY || vault.secretSlots >= 1) &&
  (fromEnv.ELEVENLABS_API_KEY || vault.secretSlots >= 2) &&
  (fromEnv.MCP_TOKEN || vault.secretSlots >= 3) &&
  (fromEnv.ELEVENLABS_VOICE_ID || vault.hasVoiceId);

if (!credsOk) {
  // vault com 3 secrets mas sem voice id ainda conta parcial
  const vaultReady = vault.secretSlots >= 3;
  if (vaultReady && !vault.hasVoiceId && !fromEnv.ELEVENLABS_VOICE_ID) {
    console.error("FAIL  falta Voice ID (Ajustes ou .env ELEVENLABS_VOICE_ID)");
    failed++;
  } else if (!vaultReady) {
    console.error(
      "FAIL  credenciais incompletas — use token no Start, painel (,) ou .env",
    );
    failed++;
  }
} else {
  console.log("PASS  credenciais (.env e/ou cofre)");
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
} else if (vault.secretSlots >= 3) {
  console.log(
    "—     MCP ping pulado (token só no cofre — o app valida ao abrir)",
  );
}

const persona = resolve(process.cwd(), "persona/AIRY_PERSONA.md");
if (existsSync(persona)) console.log("PASS  persona/AIRY_PERSONA.md");
else {
  console.error("FAIL  persona ausente");
  failed++;
}

const installMac = existsSync(resolve(process.cwd(), "install/mac/README.md"));
const installWin = existsSync(resolve(process.cwd(), "install/win/README.md"));
console.log(installMac ? "PASS  install/mac" : "—     install/mac (ainda não)");
console.log(installWin ? "PASS  install/win" : "—     install/win (ainda não)");

if (failed) {
  console.error(
    `\nDoctor: ${failed} problema(s). Abra o app → Start/Ajustes (token ou keys) e rode de novo.`,
  );
  process.exit(1);
}
console.log("\nDoctor: OK — pode usar o atalho/ícone ou npm run dev");
