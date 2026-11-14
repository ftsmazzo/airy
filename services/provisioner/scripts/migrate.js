import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL obrigatório");
  process.exit(1);
}

const sql = `
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
);

CREATE INDEX IF NOT EXISTS install_tokens_hash_idx ON install_tokens (token_hash);
`;

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
await client.query(sql);
await client.end();
console.log("migrate OK");
