/**
 * OAuth Spotify PKCE com loopback 127.0.0.1:4389
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { shell } from "electron";
import {
  buildSpotifyAuthUrl,
  exchangeSpotifyCode,
  SPOTIFY_REDIRECT_URI,
  type SpotifyTokens,
} from "@airy/agent";

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function pkcePair(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function htmlPage(title: string, body: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${title}</title>
  <style>body{font-family:system-ui;background:#0b1220;color:#e8eef7;display:grid;place-items:center;min-height:100vh;margin:0}
  .box{max-width:420px;padding:28px;border-radius:16px;border:1px solid rgba(62,203,255,.25);background:#121a2b}
  h1{font-size:18px;margin:0 0 8px}p{opacity:.85;line-height:1.45}</style></head>
  <body><div class="box"><h1>${title}</h1><p>${body}</p></div></body></html>`;
}

export async function runSpotifyOAuth(clientId: string): Promise<
  { ok: true; tokens: SpotifyTokens } | { ok: false; error: string }
> {
  const id = (clientId || "").trim();
  if (!id) {
    return {
      ok: false,
      error:
        "Informe o Spotify Client ID (developer.spotify.com → Create app → Redirect URI = http://127.0.0.1:4389/callback)",
    };
  }

  const { verifier, challenge } = pkcePair();
  const state = b64url(randomBytes(16));

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: { ok: true; tokens: SpotifyTokens } | { ok: false; error: string }) => {
      if (settled) return;
      settled = true;
      try {
        server.close();
      } catch {
        /* ok */
      }
      resolve(result);
    };

    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const url = new URL(req.url || "/", "http://127.0.0.1:4389");
        if (url.pathname !== "/callback") {
          res.writeHead(404);
          res.end("not found");
          return;
        }
        const err = url.searchParams.get("error");
        if (err) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(htmlPage("Spotify", `Autorização recusada: ${err}. Pode fechar.`));
          finish({ ok: false, error: `Spotify: ${err}` });
          return;
        }
        const code = url.searchParams.get("code") || "";
        const st = url.searchParams.get("state") || "";
        if (!code || st !== state) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(htmlPage("Spotify", "State inválido. Tente de novo nos Ajustes."));
          finish({ ok: false, error: "State/código inválido" });
          return;
        }
        const tokens = await exchangeSpotifyCode({
          code,
          codeVerifier: verifier,
          clientId: id,
          redirectUri: SPOTIFY_REDIRECT_URI,
        });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          htmlPage(
            "Spotify conectado",
            "Pode fechar esta aba e voltar à Airy. Peça uma playlist por voz.",
          ),
        );
        finish({ ok: true, tokens });
      } catch (e) {
        res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
        res.end(htmlPage("Erro", (e as Error).message));
        finish({ ok: false, error: (e as Error).message });
      }
    });

    server.on("error", (e) => {
      finish({
        ok: false,
        error: `Porta 4389 ocupada ou bloqueada: ${(e as Error).message}`,
      });
    });

    server.listen(4389, "127.0.0.1", () => {
      const authUrl = buildSpotifyAuthUrl({
        clientId: id,
        codeChallenge: challenge,
        state,
        redirectUri: SPOTIFY_REDIRECT_URI,
      });
      void shell.openExternal(authUrl);
      // timeout 3 min
      setTimeout(() => {
        finish({ ok: false, error: "Tempo esgotado — tente Conectar Spotify de novo" });
      }, 180_000);
    });
  });
}
