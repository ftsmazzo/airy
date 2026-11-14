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

server.listen(PORT, () => {
  console.log(`airy-provisioner listening on :${PORT}`);
});
