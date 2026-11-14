/**
 * Config local segura — sem banco remoto.
 * Segredos: Electron safeStorage (Keychain no Mac / DPAPI no Windows).
 * Preferências (nome, Radar): JSON em userData.
 * .env continua como fallback/importação única.
 */
import { app, safeStorage } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { sanitizeSecret } from "@airy/agent";
import type { AiryEnv } from "@airy/agent";

export type PublicSettings = {
  ownerName: string;
  /** Nome pelo qual a IA se apresenta */
  assistantName: string;
  radarUrl: string;
  openrouterModel: string;
  elevenVoiceId: string;
  elevenTtsModel: string;
  elevenStability: number;
  elevenSimilarity: number;
  elevenStyle: number;
  elevenSpeed: number;
  mcpBaseUrl: string;
  /** Pasta vigiada (assistente pessoal) */
  inboxEnabled: boolean;
  inboxPath: string;
  inboxAutoSummarizePdf: boolean;
};

export type SecretSettings = {
  openrouterApiKey: string;
  elevenApiKey: string;
  mcpToken: string;
};

export type SettingsForm = PublicSettings & SecretSettings;

type DiskFile = {
  version: 1;
  public: PublicSettings;
  secrets: Partial<Record<keyof SecretSettings, string>>; // base64 ciphertext
};

const SECRET_KEYS: (keyof SecretSettings)[] = [
  "openrouterApiKey",
  "elevenApiKey",
  "mcpToken",
];

const DEFAULT_PUBLIC: PublicSettings = {
  ownerName: "",
  assistantName: "Airy",
  radarUrl: "",
  openrouterModel: "anthropic/claude-haiku-5.5",
  elevenVoiceId: "",
  elevenTtsModel: "eleven_v4",
  elevenStability: 0.35,
  elevenSimilarity: 0.75,
  elevenStyle: 0,
  elevenSpeed: 1,
  mcpBaseUrl: "https://ie-dados-mcp.kxryyk.easypanel.host",
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
    // fallback fraco só se SO não tiver cofre — ainda local, não commitado
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

/** Modelos caros legados → default econômico (Haiku 5.5). */
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
  const pub = { ...DEFAULT_PUBLIC, ...(disk?.public || {}) };
  // Migra Sonnet/Opus salvos → Haiku 5.5 (sem chamar saveSettings: evita recursão)
  if (LEGACY_EXPENSIVE_MODELS.has(pub.openrouterModel)) {
    pub.openrouterModel = DEFAULT_PUBLIC.openrouterModel;
    try {
      writeDisk({
        version: 1,
        public: pub,
        secrets: disk?.secrets || {},
      });
    } catch {
      /* memória já usa o default econômico nesta sessão */
    }
  }
  const secrets: SecretSettings = {
    openrouterApiKey: "",
    elevenApiKey: "",
    mcpToken: "",
  };
  for (const k of SECRET_KEYS) {
    secrets[k] = decrypt(disk?.secrets?.[k] || "");
  }
  return { ...pub, ...secrets };
}

export function saveSettings(partial: Partial<SettingsForm>): SettingsForm {
  const current = loadSettings();
  const next: SettingsForm = { ...current, ...partial };
  // limpa colagem ruim (Bearer, aspas, espaços)
  for (const k of SECRET_KEYS) {
    if (typeof next[k] === "string") next[k] = sanitizeSecret(next[k]);
  }

  const secrets: DiskFile["secrets"] = {};
  for (const k of SECRET_KEYS) {
    if (next[k]) secrets[k] = encrypt(next[k]);
  }

  const pub: PublicSettings = {
    ownerName: next.ownerName,
    assistantName: next.assistantName || DEFAULT_PUBLIC.assistantName,
    radarUrl: next.radarUrl,
    openrouterModel: next.openrouterModel,
    elevenVoiceId: next.elevenVoiceId,
    elevenTtsModel: next.elevenTtsModel,
    elevenStability: next.elevenStability,
    elevenSimilarity: next.elevenSimilarity,
    elevenStyle: next.elevenStyle,
    elevenSpeed: next.elevenSpeed,
    mcpBaseUrl: next.mcpBaseUrl,
    inboxEnabled: Boolean(next.inboxEnabled),
    inboxPath: next.inboxPath || "",
    inboxAutoSummarizePdf: Boolean(next.inboxAutoSummarizePdf),
  };

  writeDisk({ version: 1, public: pub, secrets });
  return next;
}

/** Importa .env uma vez para o cofre local (não apaga o .env). */
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
  return {
    openrouterApiKey: s.openrouterApiKey || fallback.openrouterApiKey,
    openrouterModel: s.openrouterModel || fallback.openrouterModel,
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
    radarUrl: s.radarUrl || fallback.radarUrl,
    personaPath: fallback.personaPath,
    ownerName: s.ownerName || fallback.ownerName,
  };
}

export function settingsStatus(s: SettingsForm): {
  configured: boolean;
  missing: string[];
  encryption: boolean;
  path: string;
} {
  const missing: string[] = [];
  if (!s.openrouterApiKey) missing.push("OPENROUTER_API_KEY");
  if (!s.elevenApiKey) missing.push("ELEVENLABS_API_KEY");
  if (!s.elevenVoiceId) missing.push("ELEVENLABS_VOICE_ID");
  if (!s.mcpToken) missing.push("MCP_TOKEN");
  return {
    configured: missing.length === 0,
    missing,
    encryption: safeStorage.isEncryptionAvailable(),
    path: configPath(),
  };
}

/** Para a UI: não devolve segredos em claro, só se estão preenchidos. */
export function settingsPublicView(s: SettingsForm) {
  const status = settingsStatus(s);
  return {
    ...status,
    ownerName: s.ownerName,
    assistantName: s.assistantName || "Airy",
    radarUrl: s.radarUrl,
    openrouterModel: s.openrouterModel,
    elevenVoiceId: s.elevenVoiceId,
    elevenTtsModel: s.elevenTtsModel,
    elevenStability: s.elevenStability,
    elevenSimilarity: s.elevenSimilarity,
    elevenStyle: s.elevenStyle,
    elevenSpeed: s.elevenSpeed,
    mcpBaseUrl: s.mcpBaseUrl,
    hasOpenrouterApiKey: Boolean(s.openrouterApiKey),
    hasElevenApiKey: Boolean(s.elevenApiKey),
    hasMcpToken: Boolean(s.mcpToken),
    inboxEnabled: Boolean(s.inboxEnabled),
    inboxPath: s.inboxPath || "",
    inboxAutoSummarizePdf: Boolean(s.inboxAutoSummarizePdf),
  };
}
