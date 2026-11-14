/// <reference types="vite/client" />

export type AiryTurn = {
  userText: string;
  assistantText: string;
  audioBase64: string | null;
  toolTrace: string[];
};

export type AiryMcpConnView = {
  id: string;
  label: string;
  baseUrl: string;
  enabled: boolean;
  hasToken: boolean;
};

export type AirySkillView = {
  id: string;
  label: string;
  source: "bundled" | "user";
  path: string;
  enabled: boolean;
};

export type AirySettingsView = {
  configured: boolean;
  missing: string[];
  encryption: boolean;
  path: string;
  ownerName: string;
  assistantName: string;
  radarUrl: string;
  radarOpenAsApp: boolean;
  radarAppName: string;
  enabledPackages: string[];
  enabledSkills: string[];
  openrouterModel: string;
  synthesisModel: string;
  elevenVoiceId: string;
  voiceCatalog: Array<{ id: string; label: string }>;
  elevenTtsModel: string;
  elevenStability: number;
  elevenSimilarity: number;
  elevenStyle: number;
  elevenSpeed: number;
  mcpBaseUrl: string;
  mcpConnections: AiryMcpConnView[];
  spotifyClientId: string;
  hasSpotifyConnected: boolean;
  hasOpenrouterApiKey: boolean;
  hasElevenApiKey: boolean;
  hasMcpToken: boolean;
  hasLicenseToken: boolean;
  inboxEnabled: boolean;
  inboxPath: string;
  inboxAutoSummarizePdf: boolean;
  mcp?: {
    ok: boolean;
    toolCount: number;
    error?: string;
    connections?: Array<{
      id: string;
      label: string;
      ok: boolean;
      toolCount: number;
      error?: string;
    }>;
  };
};

export type AiryApi = {
  ready: () => Promise<{
    ok: boolean;
    error?: string;
    needsSetup?: boolean;
    importedFromEnv?: boolean;
    settings?: AirySettingsView;
    mcp?: AirySettingsView["mcp"];
  }>;
  getSettings: () => Promise<AirySettingsView>;
  saveSettings: (partial: Record<string, unknown>) => Promise<{
    ok: boolean;
    error?: string;
    settings?: AirySettingsView;
  }>;
  redeemToken: (token: string) => Promise<{
    ok: boolean;
    error?: string;
    settings?: AirySettingsView;
  }>;
  listSkills: () => Promise<AirySkillView[]>;
  importSkill: () => Promise<{
    ok: boolean;
    error?: string;
    skill?: AirySkillView;
    settings?: AirySettingsView;
    skills?: AirySkillView[];
  }>;
  importMcpJson: () => Promise<{
    ok: boolean;
    error?: string;
    connections?: Array<{
      id: string;
      label: string;
      baseUrl: string;
      token?: string;
    }>;
  }>;
  spotifyConnect: (clientId?: string) => Promise<{
    ok: boolean;
    error?: string;
    settings?: AirySettingsView;
  }>;
  spotifyDisconnect: () => Promise<{
    ok: boolean;
    settings?: AirySettingsView;
  }>;
  textTurn: (text: string) => Promise<AiryTurn>;
  voiceTurn: (audioBase64: string, filename: string) => Promise<AiryTurn>;
  speak: (
    text: string,
    opts?: { voiceId?: string },
  ) => Promise<{ audioBase64: string }>;
  transcribe: (
    audioBase64: string,
    filename: string,
  ) => Promise<{ text: string }>;
  enrollName: (
    audioBase64: string,
    filename: string,
  ) => Promise<{
    ok: boolean;
    name?: string;
    userText: string;
    assistantText: string;
    audioBase64: string | null;
    settings?: AirySettingsView;
  }>;
  pickFolder: () => Promise<{ ok: true; path: string } | { ok: false }>;
  defaultInboxPath: () => Promise<string>;
  onInboxFile: (
    cb: (payload: {
      path: string;
      name: string;
      autoSummarizePdf: boolean;
    }) => void,
  ) => () => void;
};

declare global {
  interface Window {
    airy?: AiryApi;
  }
}

export {};
