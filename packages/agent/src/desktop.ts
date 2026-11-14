import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  disabledPackageMessage,
  isPackageEnabled,
  packageForApp,
  packageForHost,
  type PackageId,
} from "./packages.js";

const execFileAsync = promisify(execFile);

export type DesktopConfig = {
  radarUrl: string;
  /** Se true, tenta app/PWA instalado antes do browser */
  radarOpenAsApp?: boolean;
  /** Nome do app local do Radar (opcional) */
  radarAppName?: string;
  enabledPackages?: PackageId[];
};

const YOUTUBE = "https://www.youtube.com";
const SPOTIFY_WEB = "https://open.spotify.com";

/** Apps permitidos (nome canônico → como abrir em cada OS). */
const APP_ALLOWLIST: Record<
  string,
  { mac?: string; win?: string[]; winExe?: string; web?: string }
> = {
  chrome: {
    mac: "Google Chrome",
    win: ["chrome"],
    winExe: "chrome.exe",
    web: "https://www.google.com",
  },
  safari: { mac: "Safari" },
  edge: { mac: "Microsoft Edge", win: ["msedge"], winExe: "msedge.exe" },
  firefox: { mac: "Firefox", win: ["firefox"], winExe: "firefox.exe" },
  spotify: { mac: "Spotify", win: ["spotify"], web: SPOTIFY_WEB },
  slack: { mac: "Slack", win: ["slack"], web: "https://app.slack.com" },
  notion: { mac: "Notion", win: ["notion"], web: "https://www.notion.so" },
  whatsapp: {
    mac: "WhatsApp",
    win: ["whatsapp"],
    web: "https://web.whatsapp.com",
  },
  telegram: { mac: "Telegram", win: ["telegram"], web: "https://web.telegram.org" },
  discord: { mac: "Discord", win: ["discord"], web: "https://discord.com/app" },
  vscode: { mac: "Visual Studio Code", win: ["code"], winExe: "Code.exe" },
  cursor: { mac: "Cursor", win: ["cursor"], winExe: "Cursor.exe" },
  finder: { mac: "Finder" },
  explorer: { win: ["explorer"] },
  terminal: { mac: "Terminal", win: ["wt"], winExe: "WindowsTerminal.exe" },
  notes: { mac: "Notes" },
  calendar: { mac: "Calendar" },
  mail: { mac: "Mail" },
  canva: { mac: "Canva", win: ["canva"], web: "https://www.canva.com" },
  obs: {
    mac: "OBS",
    win: ["obs64", "obs32"],
    winExe: "obs64.exe",
  },
  capcut: {
    mac: "CapCut",
    win: ["CapCut"],
    web: "https://www.capcut.com",
  },
};

function allowlisted(url: string, radarUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;

  try {
    if (radarUrl && new URL(radarUrl).host === u.host) return true;
  } catch {
    /* ignore */
  }

  if (packageForHost(u.host)) return true;

  // MCP host (não é pacote de UI)
  if (u.host === "ie-dados-mcp.kxryyk.easypanel.host") return true;
  return false;
}

function assertPackageForUrl(url: string, cfg: DesktopConfig): string | null {
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    return "URL inválida.";
  }
  try {
    if (cfg.radarUrl && new URL(cfg.radarUrl).host === host) {
      if (!isPackageEnabled(cfg.enabledPackages, "radar")) {
        return disabledPackageMessage("radar");
      }
      return null;
    }
  } catch {
    /* ignore */
  }
  const pkg = packageForHost(host);
  if (!pkg) return null; // allowlist já filtraria
  if (!isPackageEnabled(cfg.enabledPackages, pkg)) {
    return disabledPackageMessage(pkg);
  }
  return null;
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

async function openAppMac(appName: string, fallbackUrl?: string): Promise<string> {
  try {
    await execFileAsync("open", ["-a", appName]);
    return `App ${appName} aberto.`;
  } catch {
    if (fallbackUrl) return openUrl(fallbackUrl);
    return `Não achei o app ${appName}.`;
  }
}

function normalizeAppKey(name: string): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export async function openRadarMunicipal(cfg: DesktopConfig): Promise<string> {
  if (!isPackageEnabled(cfg.enabledPackages, "radar")) {
    return disabledPackageMessage("radar");
  }
  if (!cfg.radarUrl) {
    return "Radar sem URL. Configure em Ajustes (tecla ,).";
  }
  if (!allowlisted(cfg.radarUrl, cfg.radarUrl)) {
    return "URL do Radar fora da allowlist.";
  }

  if (cfg.radarOpenAsApp) {
    const appName = (cfg.radarAppName || "Radar Municipal").trim();
    if (process.platform === "darwin") {
      try {
        await execFileAsync("open", ["-a", appName]);
        return `App do Radar aberto (${appName}).`;
      } catch {
        /* fallback browser */
      }
    }
    if (process.platform === "win32") {
      try {
        await execFileAsync("cmd", ["/c", "start", "", appName]);
        return `App do Radar aberto (${appName}).`;
      } catch {
        /* fallback browser */
      }
    }
  }

  return openUrl(cfg.radarUrl);
}

export async function openYoutube(cfg?: DesktopConfig): Promise<string> {
  if (cfg && !isPackageEnabled(cfg.enabledPackages, "youtube")) {
    return disabledPackageMessage("youtube");
  }
  return openUrl(YOUTUBE);
}

export async function openSpotify(cfg?: DesktopConfig): Promise<string> {
  return openNamedApp("spotify", cfg);
}

export async function openAllowedUrl(url: string, cfg: DesktopConfig): Promise<string> {
  if (!allowlisted(url, cfg.radarUrl)) {
    return `URL bloqueada (fora da allowlist): ${url}`;
  }
  const blocked = assertPackageForUrl(url, cfg);
  if (blocked) return blocked;
  return openUrl(url);
}

export async function openNamedApp(
  appName: string,
  cfg?: DesktopConfig,
): Promise<string> {
  const key = normalizeAppKey(appName);
  const aliases: Record<string, string> = {
    googlechrome: "chrome",
    navegador: "chrome",
    code: "vscode",
    visualstudiocode: "vscode",
    explorador: "explorer",
    arquivos: "finder",
    obsstudio: "obs",
  };
  const canon = aliases[key] || key;
  const spec = APP_ALLOWLIST[canon];
  if (!spec) {
    return `App não está na allowlist: ${appName}. Permitidos: ${Object.keys(APP_ALLOWLIST).join(", ")}.`;
  }

  const pkg = packageForApp(canon);
  if (pkg && cfg && !isPackageEnabled(cfg.enabledPackages, pkg)) {
    return disabledPackageMessage(pkg);
  }

  if (process.platform === "darwin") {
    if (spec.mac) return openAppMac(spec.mac, spec.web);
    if (spec.web) return openUrl(spec.web);
    return `App ${appName} não disponível no Mac.`;
  }

  if (process.platform === "win32") {
    const candidates = [...(spec.win || []), spec.winExe].filter(Boolean) as string[];
    for (const cmd of candidates) {
      try {
        await execFileAsync("cmd", ["/c", "start", "", cmd]);
        return `App ${canon} aberto.`;
      } catch {
        /* try next */
      }
    }
    if (spec.web) return openUrl(spec.web);
    return `Não achei o app ${canon} no Windows.`;
  }

  if (spec.web) return openUrl(spec.web);
  return `Abrir app não suportado neste SO.`;
}

export function listAllowedApps(): string[] {
  return Object.keys(APP_ALLOWLIST);
}

export const DESKTOP_TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "open_radar_municipal",
      description:
        "Abre o Radar / atalho principal. Se o usuário pedir o app do Radar, ainda use esta tool (a preferência app vs browser vem da config). URL só da config do usuário.",
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
        "Abre uma URL http(s) se estiver na allowlist e o pacote estiver ligado (ChatGPT, Claude, Google, Gemini, Perplexity, Notion, Canva, LinkedIn, Pinterest, YouTube, Spotify, Radar, G1, CNN, etc.).",
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
  {
    type: "function" as const,
    function: {
      name: "open_app",
      description:
        "Abre um aplicativo instalado da allowlist (chrome, spotify, slack, notion, whatsapp, telegram, discord, vscode, cursor, canva, capcut, obs, safari, edge, finder/explorer, terminal, notes, mail, calendar). Use quando pedirem o app/PWA, não o site.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Nome do app, ex.: chrome, spotify, slack, cursor",
          },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
];
