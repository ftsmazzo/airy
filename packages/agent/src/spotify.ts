/**
 * Spotify Web API — busca e playback (requer OAuth PKCE no desktop).
 * Tokens nunca são logados.
 */

export type SpotifyTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  clientId: string;
};

export type SpotifyConfig = {
  tokens: SpotifyTokens | null;
  /** Chamado quando o refresh atualiza tokens */
  onTokens?: (t: SpotifyTokens) => void;
};

const API = "https://api.spotify.com/v1";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

export const SPOTIFY_SCOPES = [
  "user-modify-playback-state",
  "user-read-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
].join(" ");

export const SPOTIFY_REDIRECT_URI = "http://127.0.0.1:4389/callback";

async function refreshAccess(tokens: SpotifyTokens): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
    client_id: tokens.clientId,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Spotify refresh falhou (${res.status}): ${t.slice(0, 120)}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || tokens.refreshToken,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    clientId: tokens.clientId,
  };
}

async function authFetch(
  cfg: SpotifyConfig,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  if (!cfg.tokens?.accessToken) {
    throw new Error("Spotify não conectado — ligue em Ajustes");
  }
  let tokens = cfg.tokens;
  if (Date.now() >= tokens.expiresAt - 5_000) {
    tokens = await refreshAccess(tokens);
    cfg.tokens = tokens;
    cfg.onTokens?.(tokens);
  }
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (res.status === 401) {
    tokens = await refreshAccess(tokens);
    cfg.tokens = tokens;
    cfg.onTokens?.(tokens);
    return fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
  }
  return res;
}

export async function spotifySearchPlay(
  cfg: SpotifyConfig,
  query: string,
): Promise<string> {
  const q = (query || "").trim();
  if (!q) return "Diga o nome da playlist, álbum ou música.";
  if (!cfg.tokens) {
    return "Spotify não conectado. Em Ajustes → Conectar Spotify (OAuth).";
  }

  // 1) busca playlist
  const search = await authFetch(
    cfg,
    `/search?type=playlist,track,album&limit=5&q=${encodeURIComponent(q)}`,
  );
  if (!search.ok) {
    const t = await search.text();
    return `Busca Spotify falhou (${search.status}): ${t.slice(0, 140)}`;
  }
  const data = (await search.json()) as {
    playlists?: { items?: Array<{ name: string; uri: string; id: string }> };
    tracks?: { items?: Array<{ name: string; uri: string; artists?: Array<{ name: string }> }> };
    albums?: { items?: Array<{ name: string; uri: string }> };
  };

  const playlist = (data.playlists?.items || []).find((p) => p?.uri);
  const track = (data.tracks?.items || []).find((t) => t?.uri);
  const album = (data.albums?.items || []).find((a) => a?.uri);

  let contextUri = "";
  let uris: string[] | undefined;
  let label = "";

  if (playlist) {
    contextUri = playlist.uri;
    label = `playlist “${playlist.name}”`;
  } else if (album) {
    contextUri = album.uri;
    label = `álbum “${album.name}”`;
  } else if (track) {
    uris = [track.uri];
    label = `faixa “${track.name}”${track.artists?.[0] ? ` — ${track.artists[0].name}` : ""}`;
  } else {
    return `Não achei “${q}” na sua conta Spotify. Tente outro nome.`;
  }

  // 2) devices
  const devRes = await authFetch(cfg, "/me/player/devices");
  let deviceId: string | undefined;
  if (devRes.ok) {
    const devices = (await devRes.json()) as {
      devices?: Array<{ id: string; name: string; is_active: boolean; type: string }>;
    };
    const list = devices.devices || [];
    const active = list.find((d) => d.is_active) || list[0];
    deviceId = active?.id;
  }

  const playPath = deviceId
    ? `/me/player/play?device_id=${encodeURIComponent(deviceId)}`
    : `/me/player/play`;
  const body = contextUri ? { context_uri: contextUri } : { uris };

  const play = await authFetch(cfg, playPath, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  if (play.status === 204 || play.ok) {
    return `Tocando ${label} no Spotify.`;
  }
  if (play.status === 404) {
    return `Achei ${label}, mas nenhum aparelho Spotify ativo. Abra o app Spotify no PC e peça de novo.`;
  }
  if (play.status === 403) {
    return `Achei ${label}, mas a conta precisa de Spotify Premium para controlar a reprodução pela API.`;
  }
  const err = await play.text();
  return `Não consegui tocar (${play.status}): ${err.slice(0, 140)}`;
}

export async function exchangeSpotifyCode(opts: {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri?: string;
}): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri || SPOTIFY_REDIRECT_URI,
    client_id: opts.clientId,
    code_verifier: opts.codeVerifier,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Troca de código Spotify falhou (${res.status}): ${t.slice(0, 160)}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    clientId: opts.clientId,
  };
}

export function buildSpotifyAuthUrl(opts: {
  clientId: string;
  codeChallenge: string;
  state: string;
  redirectUri?: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    response_type: "code",
    redirect_uri: opts.redirectUri || SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES,
    code_challenge_method: "S256",
    code_challenge: opts.codeChallenge,
    state: opts.state,
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}
