/**
 * Config local segura — sem banco remoto.
 * Segredos: Electron safeStorage (Keychain no Mac / DPAPI no Windows).
 */
import { app, safeStorage } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  DEFAULT_ROUTER_MODEL,
  DEFAULT_SYNTHESIS_MODEL,
  defaultEnabledPackages,
  defaultUserSkillsDir,
  normalizeEnabledPackages,
  normalizeMcpConnections,
  sanitizeSecret,
  type AiryEnv,
  type McpConnectionPublic,
  type McpConnectionSecret,
  type PackageId,
  type SpotifyTokens,
} from "@airy/agent";

export type VoiceOption = { id: string; label: string };

export type PublicSettings = {
  ownerName: string;
  assistantName: string;
  radarUrl: string;
  radarOpenAsApp: boolean;
  radarAppName: string;
  enabledPackages: PackageId[];
  /** Skills ligadas (ids); vazio = todas do catálogo */
  enabledSkills: string[];
  /** Roteador barato */
  openrouterModel: string;
  /** Síntese final mais capaz */
  synthesisModel: string;
  elevenVoiceId: string;
  voiceCatalog: VoiceOption[];
  elevenTtsModel: string;
  elevenStability: number;
  elevenSimilarity: number;
  elevenStyle: number;
  elevenSpeed: number;
  mcpBaseUrl: string;
  /** Conexões MCP (sem tokens) */
  mcpConnections: McpConnectionPublic[];
  /** Client ID público do app Spotify (developer.spotify.com) */
  spotifyClientId: string;
  inboxEnabled: boolean;
  inboxPath: string;
  inboxAutoSummarizePdf: boolean;
};

export type SecretSettings = {
  openrouterApiKey: string;
  elevenApiKey: string;
  mcpToken: string;
  licenseToken: string;
  /** JSON [{id,token}] cifrado */
  mcpConnectionTokensJson: string;
  /** Tokens OAuth Spotify cifrados (JSON) */
  spotifyTokensJson: string;
};

export type SettingsForm = PublicSettings & SecretSettings;

type DiskFile = {
  version: 1;
  public: PublicSettings;
  secrets: Partial<Record<keyof SecretSettings, string>>;
};

const SECRET_KEYS: (keyof SecretSettings)[] = [
  "openrouterApiKey",
  "elevenApiKey",
  "mcpToken",
  "licenseToken",
  "mcpConnectionTokensJson",
  "spotifyTokensJson",
];

const DEFAULT_PUBLIC: PublicSettings = {
  ownerName: "",
  assistantName: "Airy",
  radarUrl: "",
  radarOpenAsApp: false,
  radarAppName: "Radar Municipal",
  enabledPackages: defaultEnabledPackages(),
  enabledSkills: [],
  openrouterModel: DEFAULT_ROUTER_MODEL,
  synthesisModel: DEFAULT_SYNTHESIS_MODEL,
  elevenVoiceId: "",
  voiceCatalog: [],
  elevenTtsModel: "eleven_v4",
  elevenStability: 0.35,
  elevenSimilarity: 0.75,
  elevenStyle: 0,
  elevenSpeed: 1,
  mcpBaseUrl: "https://ie-dados-mcp.kxryyk.easypanel.host",
  mcpConnections: [],
  spotifyClientId: "",
  inboxEnabled: true,
  inboxPath: "",
  inboxAutoSummarizePdf: false,
};

function configPath(): string {
  return join(app.getPath("userData"), "airy-secure.json");
}

function encrypt(plain: string): string {
  if (!plain) return "";
  if (!safeStorage.isEncryptionAvailable()) {
    return `plain:${Buffer.from(plain, "utf8").toString("base64")}`;
  }
  return safeStorage.encryptString(plain).toString("base64");
}

function decrypt(blob: string): string {
  if (!blob) return "";
  if (blob.startsWith("plain:")) {
    return Buffer.from(blob.slice(6), "base64").toString("utf8");
  }
  if (!safeStorage.isEncryptionAvailable()) return "";
  try {
    return safeStorage.decryptString(Buffer.from(blob, "base64"));
  } catch {
    return "";
  }
}

function readDisk(): DiskFile | null {
  const p = configPath();
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as DiskFile;
  } catch {
    return null;
  }
}

function writeDisk(file: DiskFile): void {
  const p = configPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(file, null, 2), "utf8");
}

function parseMcpTokensJson(raw: string): McpConnectionSecret[] {
  if (!raw?.trim()) return [];
  try {
    const arr = JSON.parse(raw) as McpConnectionSecret[];
    if (!Array.isArray(arr)) return [];
    return arr
      .map((t) => ({
        id: String(t?.id || "").trim(),
        token: sanitizeSecret(String(t?.token || "")),
      }))
      .filter((t) => t.id && t.token);
  } catch {
    return [];
  }
}

function normalizeMcpPublic(raw: unknown): McpConnectionPublic[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => ({
      id: String((c as McpConnectionPublic)?.id || "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 32),
      label: String((c as McpConnectionPublic)?.label || "").trim().slice(0, 80),
      baseUrl: String((c as McpConnectionPublic)?.baseUrl || "").trim().replace(/\/$/, ""),
      enabled: (c as McpConnectionPublic)?.enabled !== false,
    }))
    .filter((c) => c.id && c.baseUrl);
}

const LEGACY_EXPENSIVE_MODELS = new Set([
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-sonnet-4",
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3.7-sonnet",
  "anthropic/claude-opus-4",
  "anthropic/claude-opus-4.1",
]);

export function loadSettings(): SettingsForm {
  const disk = readDisk();
  const diskPub = disk?.public as Partial<PublicSettings> | undefined;
  const pub: PublicSettings = {
    ...DEFAULT_PUBLIC,
    ...(diskPub || {}),
    enabledPackages: normalizeEnabledPackages(diskPub?.enabledPackages),
    enabledSkills: Array.isArray(diskPub?.enabledSkills)
      ? diskPub!.enabledSkills.map(String)
      : [],
    radarOpenAsApp: Boolean(diskPub?.radarOpenAsApp),
    radarAppName:
      String(diskPub?.radarAppName || "").trim() || DEFAULT_PUBLIC.radarAppName,
    synthesisModel:
      String(diskPub?.synthesisModel || "").trim() || DEFAULT_SYNTHESIS_MODEL,
    mcpConnections: normalizeMcpPublic(diskPub?.mcpConnections),
  };

  // Router caro → move para synthesis e usa Haiku no router
  if (LEGACY_EXPENSIVE_MODELS.has(pub.openrouterModel)) {
    if (!diskPub?.synthesisModel) pub.synthesisModel = pub.openrouterModel;
    pub.openrouterModel = DEFAULT_ROUTER_MODEL;
    try {
      writeDisk({ version: 1, public: pub, secrets: disk?.secrets || {} });
    } catch {
      /* ok */
    }
  }

  const secrets: SecretSettings = {
    openrouterApiKey: "",
    elevenApiKey: "",
    mcpToken: "",
    licenseToken: "",
    mcpConnectionTokensJson: "",
    spotifyTokensJson: "",
  };
  for (const k of SECRET_KEYS) {
    secrets[k] = decrypt(disk?.secrets?.[k] || "");
  }
  return { ...pub, ...secrets };
}

export function saveSettings(partial: Partial<SettingsForm>): SettingsForm {
  const current = loadSettings();
  const next: SettingsForm = { ...current, ...partial };
  for (const k of SECRET_KEYS) {
    if (typeof next[k] === "string") {
      if (k === "mcpConnectionTokensJson") {
        // keep JSON shape; sanitize tokens inside
        const toks = parseMcpTokensJson(next[k]);
        next[k] = toks.length ? JSON.stringify(toks) : "";
      } else {
        next[k] = sanitizeSecret(next[k]);
      }
    }
  }

  const secrets: DiskFile["secrets"] = {};
  for (const k of SECRET_KEYS) {
    if (next[k]) secrets[k] = encrypt(next[k]);
  }

  const pub: PublicSettings = {
    ownerName: next.ownerName,
    assistantName: next.assistantName || DEFAULT_PUBLIC.assistantName,
    radarUrl: next.radarUrl,
    radarOpenAsApp: Boolean(next.radarOpenAsApp),
    radarAppName:
      String(next.radarAppName || "").trim() || DEFAULT_PUBLIC.radarAppName,
    enabledPackages: normalizeEnabledPackages(next.enabledPackages),
    enabledSkills: Array.isArray(next.enabledSkills)
      ? next.enabledSkills.map(String)
      : [],
    openrouterModel: next.openrouterModel || DEFAULT_ROUTER_MODEL,
    synthesisModel: next.synthesisModel || DEFAULT_SYNTHESIS_MODEL,
    elevenVoiceId: next.elevenVoiceId,
    voiceCatalog: Array.isArray(next.voiceCatalog)
      ? next.voiceCatalog
          .map((v) => ({
            id: String(v?.id || "").trim(),
            label: String(v?.label || v?.id || "").trim(),
          }))
          .filter((v) => v.id)
      : current.voiceCatalog || [],
    elevenTtsModel: next.elevenTtsModel,
    elevenStability: next.elevenStability,
    elevenSimilarity: next.elevenSimilarity,
    elevenStyle: next.elevenStyle,
    elevenSpeed: next.elevenSpeed,
    mcpBaseUrl: next.mcpBaseUrl,
    mcpConnections: normalizeMcpPublic(next.mcpConnections),
    spotifyClientId: String(next.spotifyClientId || "").trim(),
    inboxEnabled: Boolean(next.inboxEnabled),
    inboxPath: next.inboxPath || "",
    inboxAutoSummarizePdf: Boolean(next.inboxAutoSummarizePdf),
  };

  writeDisk({ version: 1, public: pub, secrets });
  return next;
}

export function importFromEnvIfEmpty(env: AiryEnv): boolean {
  const cur = loadSettings();
  const hasSecrets = Boolean(cur.openrouterApiKey && cur.elevenApiKey && cur.mcpToken);
  if (hasSecrets) return false;

  const next: Partial<SettingsForm> = {};
  if (env.openrouterApiKey) next.openrouterApiKey = env.openrouterApiKey;
  if (env.elevenApiKey) next.elevenApiKey = env.elevenApiKey;
  if (env.mcpToken) next.mcpToken = env.mcpToken;
  if (env.elevenVoiceId) next.elevenVoiceId = env.elevenVoiceId;
  if (env.radarUrl) next.radarUrl = env.radarUrl;
  if (env.ownerName) next.ownerName = env.ownerName;
  if (env.openrouterModel) next.openrouterModel = env.openrouterModel;
  if (env.synthesisModel) next.synthesisModel = env.synthesisModel;
  if (env.elevenTtsModel) next.elevenTtsModel = env.elevenTtsModel;
  if (env.mcpBaseUrl) next.mcpBaseUrl = env.mcpBaseUrl;
  if (env.elevenStability != null) next.elevenStability = env.elevenStability;
  if (env.elevenSimilarity != null) next.elevenSimilarity = env.elevenSimilarity;
  if (env.elevenStyle != null) next.elevenStyle = env.elevenStyle;
  if (env.elevenSpeed != null) next.elevenSpeed = env.elevenSpeed;

  if (!next.openrouterApiKey && !next.elevenApiKey && !next.mcpToken) return false;
  saveSettings(next);
  return true;
}

export function settingsToAiryEnv(s: SettingsForm, fallback: AiryEnv): AiryEnv {
  const tokens = parseMcpTokensJson(s.mcpConnectionTokensJson);
  // legado: se tem mcpToken e conexão ie-dados sem token na lista
  if (s.mcpToken) {
    const hasIe = tokens.some((t) => t.id === "ie-dados");
    if (!hasIe) tokens.push({ id: "ie-dados", token: s.mcpToken });
  }
  let conns = normalizeMcpPublic(s.mcpConnections);
  if (!conns.length && (s.mcpToken || s.mcpBaseUrl)) {
    conns = [
      {
        id: "ie-dados",
        label: "ie-dados",
        baseUrl: s.mcpBaseUrl || "https://ie-dados-mcp.kxryyk.easypanel.host",
        enabled: true,
      },
    ];
  }

  return {
    openrouterApiKey: s.openrouterApiKey || fallback.openrouterApiKey,
    openrouterModel: s.openrouterModel || fallback.openrouterModel || DEFAULT_ROUTER_MODEL,
    synthesisModel:
      s.synthesisModel || fallback.synthesisModel || DEFAULT_SYNTHESIS_MODEL,
    researchModel: fallback.researchModel || "perplexity/sonar",
    elevenApiKey: s.elevenApiKey || fallback.elevenApiKey,
    elevenVoiceId: s.elevenVoiceId || fallback.elevenVoiceId,
    elevenTtsModel: s.elevenTtsModel || fallback.elevenTtsModel,
    elevenStability: s.elevenStability ?? fallback.elevenStability,
    elevenSimilarity: s.elevenSimilarity ?? fallback.elevenSimilarity,
    elevenStyle: s.elevenStyle ?? fallback.elevenStyle,
    elevenSpeed: s.elevenSpeed ?? fallback.elevenSpeed,
    mcpToken: s.mcpToken || fallback.mcpToken,
    mcpBaseUrl: s.mcpBaseUrl || fallback.mcpBaseUrl,
    mcpConnections: conns,
    mcpConnectionTokens: tokens,
    radarUrl: s.radarUrl || fallback.radarUrl,
    radarOpenAsApp: Boolean(s.radarOpenAsApp),
    radarAppName: s.radarAppName || fallback.radarAppName,
    enabledPackages: normalizeEnabledPackages(s.enabledPackages),
    enabledSkills: Array.isArray(s.enabledSkills) ? s.enabledSkills : [],
    userSkillsDir: defaultUserSkillsDir(),
    personaPath: fallback.personaPath,
    ownerName: s.ownerName || fallback.ownerName,
    assistantName: s.assistantName || fallback.assistantName || "Airy",
    spotifyClientId: s.spotifyClientId || fallback.spotifyClientId,
    spotifyTokens: parseSpotifyTokens(s.spotifyTokensJson),
  };
}

function parseSpotifyTokens(raw: string): SpotifyTokens | null {
  if (!raw?.trim()) return null;
  try {
    const t = JSON.parse(raw) as SpotifyTokens;
    if (!t?.accessToken || !t?.refreshToken || !t?.clientId) return null;
    return {
      accessToken: String(t.accessToken),
      refreshToken: String(t.refreshToken),
      expiresAt: Number(t.expiresAt) || 0,
      clientId: String(t.clientId),
    };
  } catch {
    return null;
  }
}

export function saveSpotifyTokens(tokens: SpotifyTokens | null): SettingsForm {
  if (!tokens) {
    return saveSettings({ spotifyTokensJson: "" });
  }
  return saveSettings({
    spotifyClientId: tokens.clientId,
    spotifyTokensJson: JSON.stringify(tokens),
  });
}

function hasAnyMcp(s: SettingsForm): boolean {
  if (s.mcpToken) return true;
  return parseMcpTokensJson(s.mcpConnectionTokensJson).length > 0;
}

export function settingsStatus(s: SettingsForm): {
  configured: boolean;
  missing: string[];
  encryption: boolean;
  path: string;
} {
  const missing: string[] = [];
  if (!s.licenseToken) missing.push("TOKEN");
  if (!s.openrouterApiKey) missing.push("OPENROUTER_API_KEY");
  if (!s.elevenApiKey) missing.push("ELEVENLABS_API_KEY");
  if (!s.elevenVoiceId) missing.push("ELEVENLABS_VOICE_ID");
  // MCP opcional (soft-fail), mas avisamos
  if (!hasAnyMcp(s)) missing.push("MCP");
  // MCP missing não bloqueia "configured" se o resto ok? Mantém bloqueio leve:
  // na prática redeem sempre traz MCP. Soft-fail no agent.ready.
  const hardMissing = missing.filter((m) => m !== "MCP");
  return {
    configured: hardMissing.length === 0,
    missing,
    encryption: safeStorage.isEncryptionAvailable(),
    path: configPath(),
  };
}

export function clearLicensedSecrets(): SettingsForm {
  return saveSettings({
    openrouterApiKey: "",
    elevenApiKey: "",
    mcpToken: "",
    licenseToken: "",
    mcpConnectionTokensJson: "",
    spotifyTokensJson: "",
  });
}

export function settingsPublicView(s: SettingsForm) {
  const status = settingsStatus(s);
  const tokenIds = new Set(parseMcpTokensJson(s.mcpConnectionTokensJson).map((t) => t.id));
  if (s.mcpToken) tokenIds.add("ie-dados");
  const mcpConnections = normalizeMcpConnections(
    s.mcpConnections,
    [...tokenIds].map((id) => ({ id, token: "x" })),
    { baseUrl: s.mcpBaseUrl, token: s.mcpToken },
  ).map((c) => ({
    id: c.id,
    label: c.label,
    baseUrl: c.baseUrl,
    enabled: c.enabled,
    hasToken: tokenIds.has(c.id),
  }));

  return {
    ...status,
    ownerName: s.ownerName,
    assistantName: s.assistantName || "Airy",
    radarUrl: s.radarUrl,
    radarOpenAsApp: Boolean(s.radarOpenAsApp),
    radarAppName: s.radarAppName || DEFAULT_PUBLIC.radarAppName,
    enabledPackages: normalizeEnabledPackages(s.enabledPackages),
    enabledSkills: Array.isArray(s.enabledSkills) ? s.enabledSkills : [],
    openrouterModel: s.openrouterModel,
    synthesisModel: s.synthesisModel || DEFAULT_SYNTHESIS_MODEL,
    elevenVoiceId: s.elevenVoiceId,
    voiceCatalog: Array.isArray(s.voiceCatalog) ? s.voiceCatalog : [],
    elevenTtsModel: s.elevenTtsModel,
    elevenStability: s.elevenStability,
    elevenSimilarity: s.elevenSimilarity,
    elevenStyle: s.elevenStyle,
    elevenSpeed: s.elevenSpeed,
    mcpBaseUrl: s.mcpBaseUrl,
    mcpConnections,
    spotifyClientId: s.spotifyClientId || "",
    hasSpotifyConnected: Boolean(parseSpotifyTokens(s.spotifyTokensJson)),
    hasOpenrouterApiKey: Boolean(s.openrouterApiKey),
    hasElevenApiKey: Boolean(s.elevenApiKey),
    hasMcpToken: hasAnyMcp(s),
    hasLicenseToken: Boolean(s.licenseToken),
    inboxEnabled: Boolean(s.inboxEnabled),
    inboxPath: s.inboxPath || "",
    inboxAutoSummarizePdf: Boolean(s.inboxAutoSummarizePdf),
  };
}

/** Merge tokens MCP sem apagar os que a UI não reenviou. */
export function mergeMcpConnectionTokens(
  currentJson: string,
  updates: Array<{ id: string; token?: string }>,
): string {
  const map = new Map(parseMcpTokensJson(currentJson).map((t) => [t.id, t.token]));
  for (const u of updates) {
    const id = String(u.id || "").trim();
    if (!id) continue;
    const tok = sanitizeSecret(String(u.token || ""));
    if (tok) map.set(id, tok);
  }
  const arr = [...map.entries()].map(([id, token]) => ({ id, token }));
  return arr.length ? JSON.stringify(arr) : "";
}
