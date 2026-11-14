/**
 * Airy provisioner — redeem de token de instalação.
 * Sem painel admin. HTTPS na frente (EasyPanel).
 */
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import pg from "pg";

const PORT = Number(process.env.PORT || 8080);
const DATABASE_URL = process.env.DATABASE_URL || "";
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = Number(process.env.RATE_MAX_PER_MIN || 20);

const pool = DATABASE_URL
  ? new pg.Pool({ connectionString: DATABASE_URL, max: 5 })
  : null;

async function ensureSchema() {
  if (!pool) return;
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await pool.query(`
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
  await pool.query(
    `CREATE INDEX IF NOT EXISTS install_tokens_hash_idx ON install_tokens (token_hash)`,
  );
}

/**
 * Catálogo de vozes:
 * - ELEVENLABS_VOICES='[{"id":"abc","label":"Clara"},{"id":"def","label":"Pedro"}]'
 * - ou ELEVENLABS_VOICE_IDS=id1,id2,id3 (labels = id curto)
 * - ELEVENLABS_VOICE_ID continua sendo o default
 */
function parseVoiceCatalog() {
  const rawJson = (process.env.ELEVENLABS_VOICES || "").trim();
  if (rawJson) {
    try {
      const arr = JSON.parse(rawJson);
      if (Array.isArray(arr)) {
        return arr
          .map((v) => ({
            id: String(v?.id || "").trim(),
            label: String(v?.label || v?.id || "").trim(),
          }))
          .filter((v) => v.id);
      }
    } catch (e) {
      console.error("ELEVENLABS_VOICES JSON inválido", e?.message || e);
    }
  }
  const csv = (process.env.ELEVENLABS_VOICE_IDS || "").trim();
  if (csv) {
    return csv
      .split(/[,;\s]+/)
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => ({ id, label: id.slice(0, 8) }));
  }
  const single = (process.env.ELEVENLABS_VOICE_ID || "").trim();
  if (single) return [{ id: single, label: "Padrão" }];
  return [];
}

/** Se BOOTSTRAP_TOKEN + keys estiverem nas env, upserta um token (ops sem painel). */
async function bootstrapFromEnv() {
  if (!pool) return;
  const token = (process.env.BOOTSTRAP_TOKEN || "").trim();
  if (token.length < 8) return;
  const voiceCatalog = parseVoiceCatalog();
  const defaultVoice =
    (process.env.ELEVENLABS_VOICE_ID || "").trim() ||
    voiceCatalog[0]?.id ||
    "";
  const payload = {
    version: 1,
    secrets: {
      openrouterApiKey: process.env.OPENROUTER_API_KEY || "",
      elevenApiKey: process.env.ELEVENLABS_API_KEY || "",
      mcpToken: process.env.MCP_TOKEN || "",
    },
    public: {
      elevenVoiceId: defaultVoice,
      voiceCatalog,
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
  const maxUses = Number(process.env.BOOTSTRAP_MAX_USES || 20);
  const days = Number(process.env.BOOTSTRAP_EXPIRES_DAYS || 90);
  const expiresAt = new Date(Date.now() + days * 864e5);
  await pool.query(
    `INSERT INTO install_tokens (token_hash, payload_json, max_uses, expires_at, label, uses_count, revoked_at)
     VALUES ($1, $2::jsonb, $3, $4, $5, 0, NULL)
     ON CONFLICT (token_hash) DO UPDATE SET
       payload_json = EXCLUDED.payload_json,
       max_uses = EXCLUDED.max_uses,
       expires_at = EXCLUDED.expires_at,
       revoked_at = NULL,
       label = EXCLUDED.label`,
    [
      hashToken(token),
      JSON.stringify(payload),
      maxUses,
      expiresAt,
      process.env.BOOTSTRAP_LABEL || "bootstrap",
    ],
  );
  console.log("bootstrap token upserted (label=%s)", process.env.BOOTSTRAP_LABEL || "bootstrap");
}

/** @type {Map<string, { n: number, t: number }>} */
const hits = new Map();

function hashToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function rateLimit(ip) {
  const now = Date.now();
  const cur = hits.get(ip);
  if (!cur || now - cur.t > RATE_WINDOW_MS) {
    hits.set(ip, { n: 1, t: now });
    return true;
  }
  if (cur.n >= RATE_MAX) return false;
  cur.n += 1;
  return true;
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 32_000) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function redeem(token) {
  if (!pool) throw new Error("DATABASE_URL missing");
  const tokenHash = hashToken(token);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT id, payload_json, max_uses, uses_count, expires_at, revoked_at
       FROM install_tokens WHERE token_hash = $1 FOR UPDATE`,
      [tokenHash],
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return { status: 401, body: { ok: false, error: "Token inválido" } };
    }
    const row = rows[0];
    if (row.revoked_at) {
      await client.query("ROLLBACK");
      return { status: 410, body: { ok: false, error: "Token revogado" } };
    }
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      await client.query("ROLLBACK");
      return { status: 410, body: { ok: false, error: "Token expirado" } };
    }
    if (row.uses_count >= row.max_uses) {
      await client.query("ROLLBACK");
      return { status: 410, body: { ok: false, error: "Token sem usos restantes" } };
    }
    await client.query(
      `UPDATE install_tokens SET uses_count = uses_count + 1 WHERE id = $1`,
      [row.id],
    );
    await client.query("COMMIT");
    return { status: 200, body: { ok: true, payload: row.payload_json } };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    if (!pool) return send(res, 503, { ok: false, error: "no database" });
    try {
      await pool.query("SELECT 1");
      return send(res, 200, { ok: true });
    } catch {
      return send(res, 503, { ok: false, error: "db" });
    }
  }

  if (req.method === "POST" && url.pathname === "/v1/redeem") {
    const ip = clientIp(req);
    if (!rateLimit(ip)) {
      return send(res, 429, { ok: false, error: "Muitas tentativas. Aguarde um minuto." });
    }
    try {
      const raw = await readBody(req);
      let token = "";
      try {
        const parsed = JSON.parse(raw || "{}");
        token = String(parsed.token || "").trim();
      } catch {
        return send(res, 400, { ok: false, error: "JSON inválido" });
      }
      if (token.length < 8 || token.length > 200) {
        return send(res, 400, { ok: false, error: "Token inválido" });
      }
      const result = await redeem(token);
      return send(res, result.status, result.body);
    } catch (e) {
      console.error("redeem error", (e && e.message) || e);
      return send(res, 500, { ok: false, error: "Falha interna" });
    }
  }

  send(res, 404, { ok: false, error: "not found" });
});

ensureSchema()
  .then(() => bootstrapFromEnv())
  .then(() => {
    server.listen(PORT, () => {
      console.log(`airy-provisioner listening on :${PORT}`);
    });
  })
  .catch((e) => {
    console.error("schema init failed", e?.message || e);
    process.exit(1);
  });
