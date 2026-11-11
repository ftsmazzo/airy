import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DesktopConfig = {
  radarUrl: string;
};

const YOUTUBE = "https://www.youtube.com";
const SPOTIFY_WEB = "https://open.spotify.com";

function allowlisted(url: string, radarUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const allowedHosts = new Set<string>([
    "www.youtube.com",
    "youtube.com",
    "youtu.be",
    "open.spotify.com",
    "spotify.com",
  ]);
  try {
    if (radarUrl) allowedHosts.add(new URL(radarUrl).host);
  } catch {
    /* ignore */
  }
  allowedHosts.add("ie-dados-mcp.kxryyk.easypanel.host");
  return allowedHosts.has(u.host);
}

async function openUrl(url: string): Promise<string> {
  const platform = process.platform;
  if (platform === "darwin") {
    await execFileAsync("open", [url]);
  } else if (platform === "win32") {
    await execFileAsync("cmd", ["/c", "start", "", url]);
  } else {
    await execFileAsync("xdg-open", [url]);
  }
  return `Aberto: ${url}`;
}

async function openAppMac(appName: string, fallbackUrl: string): Promise<string> {
  if (process.platform === "darwin") {
    try {
      await execFileAsync("open", ["-a", appName]);
      return `App ${appName} aberto.`;
    } catch {
      return openUrl(fallbackUrl);
    }
  }
  return openUrl(fallbackUrl);
}

export async function openRadarMunicipal(cfg: DesktopConfig): Promise<string> {
  if (!cfg.radarUrl) {
    return "AIRY_RADAR_URL não configurada. Defina a URL do atalho no .env.";
  }
  if (!allowlisted(cfg.radarUrl, cfg.radarUrl)) {
    return "URL do Radar fora da allowlist.";
  }
  return openUrl(cfg.radarUrl);
}

export async function openYoutube(): Promise<string> {
  return openUrl(YOUTUBE);
}

export async function openSpotify(): Promise<string> {
  return openAppMac("Spotify", SPOTIFY_WEB);
}

export async function openAllowedUrl(url: string, cfg: DesktopConfig): Promise<string> {
  if (!allowlisted(url, cfg.radarUrl)) {
    return `URL bloqueada (fora da allowlist): ${url}`;
  }
  return openUrl(url);
}

export const DESKTOP_TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "open_radar_municipal",
      description: "Abre o atalho Radar Municipal no navegador padrão.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "open_youtube",
      description: "Abre o YouTube no navegador.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "open_spotify",
      description: "Abre o app Spotify (ou o site se o app não estiver instalado).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "open_url",
      description:
        "Abre uma URL http(s) se estiver na allowlist (YouTube, Spotify, Radar, ie-dados).",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL completa https://" },
        },
        required: ["url"],
        additionalProperties: false,
      },
    },
  },
];
