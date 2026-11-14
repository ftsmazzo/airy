/**
 * Cria um token de instalação.
 * Uso:
 *   TOKEN=meu-token-secreto DATABASE_URL=... node scripts/seed-token.js
 *   (ou deixa gerar token aleatório e imprime uma vez)
 *
 * Payload: leia AIRY_SEED_PAYLOAD (JSON) ou use defaults vazios + env OPENROUTER_*/ELEVEN*/MCP_*
 */
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL obrigatório");
  process.exit(1);
}

function hashToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

const rawToken =
  (process.env.TOKEN || "").trim() || randomBytes(24).toString("base64url");

let payload;
if (process.env.AIRY_SEED_PAYLOAD) {
  payload = JSON.parse(process.env.AIRY_SEED_PAYLOAD);
} else {
  payload = {
    version: 1,
    secrets: {
      openrouterApiKey: process.env.OPENROUTER_API_KEY || "",
      elevenApiKey: process.env.ELEVENLABS_API_KEY || "",
      mcpToken: process.env.MCP_TOKEN || "",
    },
    public: {
      elevenVoiceId: process.env.ELEVENLABS_VOICE_ID || "",
      openrouterModel:
        process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-5.5",
      mcpBaseUrl:
        process.env.MCP_BASE_URL ||
        "https://ie-dados-mcp.kxryyk.easypanel.host",
      radarUrl: process.env.AIRY_RADAR_URL || "",
      ownerName: process.env.AIRY_OWNER_NAME || "",
      elevenTtsModel: process.env.ELEVENLABS_MODEL_ID || "eleven_v4",
      elevenStability: Number(process.env.ELEVENLABS_STABILITY || 0.35),
      elevenSimilarity: Number(process.env.ELEVENLABS_SIMILARITY || 0.75),
      elevenStyle: Number(process.env.ELEVENLABS_STYLE || 0),
      elevenSpeed: Number(process.env.ELEVENLABS_SPEED || 1),
      assistantName: process.env.AIRY_ASSISTANT_NAME || "Airy",
    },
  };
}

const maxUses = Number(process.env.MAX_USES || 5);
const days = Number(process.env.EXPIRES_DAYS || 30);
const label = process.env.LABEL || "seed";
const expiresAt = new Date(Date.now() + days * 864e5);

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
await client.query(`
CREATE TABLE IF NOT EXISTS install_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  payload_json JSONB NOT NULL,
  max_uses INT NOT NULL DEFAULT 3,
  uses_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  label TEXT
)`);

await client.query(
  `INSERT INTO install_tokens (token_hash, payload_json, max_uses, expires_at, label)
   VALUES ($1, $2::jsonb, $3, $4, $5)
   ON CONFLICT (token_hash) DO UPDATE SET
     payload_json = EXCLUDED.payload_json,
     max_uses = EXCLUDED.max_uses,
     expires_at = EXCLUDED.expires_at,
     revoked_at = NULL,
     uses_count = 0,
     label = EXCLUDED.label`,
  [hashToken(rawToken), JSON.stringify(payload), maxUses, expiresAt, label],
);
await client.end();

console.log("seed OK");
console.log(`label=${label} max_uses=${maxUses} expires=${expiresAt.toISOString()}`);
console.log("--- TOKEN (guarde; não fica no banco em claro) ---");
console.log(rawToken);
console.log("------------------------------------------------");
