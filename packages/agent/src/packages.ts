/**
 * Pacotes pré-autorizados (lista Ary) — toggles no Ajustes.
 * Allowlist de hosts/apps nunca fica “abrir tudo”; só o que está aqui + Radar URL.
 */

export type PackageId =
  | "radar"
  | "chatgpt"
  | "claude"
  | "perplexity"
  | "google"
  | "gemini"
  | "notion"
  | "canva"
  | "linkedin"
  | "pinterest"
  | "lovable"
  | "manus"
  | "youtube"
  | "spotify"
  | "whatsapp"
  | "slack"
  | "discord"
  | "telegram"
  | "news"
  | "obs"
  | "capcut"
  | "chrome"
  | "cursor"
  | "vscode"
  | "notepad"
  | "word";

export type PackageDef = {
  id: PackageId;
  label: string;
  /** Hosts http(s) cobertos por este pacote */
  hosts?: string[];
  /** Chaves de APP_ALLOWLIST cobertas */
  apps?: string[];
  defaultOn?: boolean;
};

export const PACKAGE_CATALOG: PackageDef[] = [
  {
    id: "radar",
    label: "Radar / atalho principal",
    defaultOn: true,
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    hosts: ["chatgpt.com", "chat.openai.com"],
    defaultOn: true,
  },
  {
    id: "claude",
    label: "Claude",
    hosts: ["claude.ai", "www.claude.ai"],
    defaultOn: true,
  },
  {
    id: "perplexity",
    label: "Perplexity",
    hosts: ["perplexity.ai", "www.perplexity.ai"],
    defaultOn: true,
  },
  {
    id: "google",
    label: "Google",
    hosts: ["www.google.com", "google.com"],
    apps: ["chrome"],
    defaultOn: true,
  },
  {
    id: "gemini",
    label: "Gemini",
    hosts: ["gemini.google.com"],
    defaultOn: true,
  },
  {
    id: "notion",
    label: "Notion",
    hosts: ["www.notion.so", "notion.so"],
    apps: ["notion"],
    defaultOn: true,
  },
  {
    id: "canva",
    label: "Canva",
    hosts: ["www.canva.com", "canva.com"],
    apps: ["canva"],
    defaultOn: true,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    hosts: ["www.linkedin.com", "linkedin.com"],
    defaultOn: true,
  },
  {
    id: "pinterest",
    label: "Pinterest",
    hosts: ["www.pinterest.com", "pinterest.com", "br.pinterest.com"],
    defaultOn: true,
  },
  {
    id: "lovable",
    label: "Lovable",
    hosts: ["www.lovable.dev", "lovable.dev"],
    defaultOn: true,
  },
  {
    id: "manus",
    label: "Manus",
    hosts: ["www.manus.im", "manus.im"],
    defaultOn: true,
  },
  {
    id: "youtube",
    label: "YouTube",
    hosts: ["www.youtube.com", "youtube.com", "youtu.be", "m.youtube.com"],
    defaultOn: true,
  },
  {
    id: "spotify",
    label: "Spotify",
    hosts: ["open.spotify.com", "spotify.com"],
    apps: ["spotify"],
    defaultOn: true,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    hosts: ["web.whatsapp.com"],
    apps: ["whatsapp"],
    defaultOn: true,
  },
  {
    id: "slack",
    label: "Slack",
    hosts: ["app.slack.com"],
    apps: ["slack"],
    defaultOn: true,
  },
  {
    id: "discord",
    label: "Discord",
    hosts: ["discord.com"],
    apps: ["discord"],
    defaultOn: true,
  },
  {
    id: "telegram",
    label: "Telegram",
    hosts: ["web.telegram.org"],
    apps: ["telegram"],
    defaultOn: true,
  },
  {
    id: "news",
    label: "Notícias (G1, UOL, BBC, CNN)",
    hosts: [
      "g1.globo.com",
      "www.uol.com.br",
      "uol.com.br",
      "www.bbc.com",
      "cnn.com",
      "www.cnn.com",
      "edition.cnn.com",
    ],
    defaultOn: true,
  },
  {
    id: "obs",
    label: "OBS",
    apps: ["obs"],
    defaultOn: true,
  },
  {
    id: "capcut",
    label: "CapCut",
    hosts: ["www.capcut.com", "capcut.com"],
    apps: ["capcut"],
    defaultOn: true,
  },
  {
    id: "chrome",
    label: "Chrome / Edge / Firefox",
    apps: ["chrome", "edge", "firefox", "safari"],
    defaultOn: true,
  },
  {
    id: "cursor",
    label: "Cursor",
    apps: ["cursor"],
    defaultOn: true,
  },
  {
    id: "vscode",
    label: "VS Code",
    apps: ["vscode"],
    defaultOn: true,
  },
  {
    id: "notepad",
    label: "Bloco de notas / TextEdit",
    apps: ["notepad", "wordpad"],
    defaultOn: true,
  },
  {
    id: "word",
    label: "Microsoft Word",
    apps: ["word"],
    defaultOn: true,
  },
];

const CATALOG_BY_ID = new Map(PACKAGE_CATALOG.map((p) => [p.id, p]));

export function defaultEnabledPackages(): PackageId[] {
  return PACKAGE_CATALOG.filter((p) => p.defaultOn !== false).map((p) => p.id);
}

export function normalizeEnabledPackages(
  raw: unknown,
): PackageId[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultEnabledPackages();
  const ids = new Set(PACKAGE_CATALOG.map((p) => p.id));
  const out = raw
    .map((x) => String(x || "").trim())
    .filter((x): x is PackageId => ids.has(x as PackageId));
  return out.length ? out : defaultEnabledPackages();
}

export function packageLabel(id: PackageId): string {
  return CATALOG_BY_ID.get(id)?.label || id;
}

export function packageForHost(host: string): PackageId | null {
  const h = (host || "").toLowerCase();
  for (const p of PACKAGE_CATALOG) {
    if (p.hosts?.some((x) => x.toLowerCase() === h)) return p.id;
  }
  return null;
}

export function packageForApp(appKey: string): PackageId | null {
  const key = (appKey || "").toLowerCase();
  for (const p of PACKAGE_CATALOG) {
    if (p.apps?.includes(key)) return p.id;
  }
  return null;
}

export function isPackageEnabled(
  enabled: PackageId[] | undefined,
  id: PackageId,
): boolean {
  const list = enabled?.length ? enabled : defaultEnabledPackages();
  return list.includes(id);
}

export function disabledPackageMessage(id: PackageId): string {
  return `${packageLabel(id)} está desligado nos Pacotes. Abra Ajustes (tecla ,) para ligar.`;
}
