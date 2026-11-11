/// <reference types="vite/client" />

export type AiryTurn = {
  userText: string;
  assistantText: string;
  audioBase64: string | null;
  toolTrace: string[];
};

export type AirySettingsView = {
  configured: boolean;
  missing: string[];
  encryption: boolean;
  path: string;
  ownerName: string;
  radarUrl: string;
  openrouterModel: string;
  elevenVoiceId: string;
  elevenTtsModel: string;
  elevenStability: number;
  elevenSimilarity: number;
  elevenStyle: number;
  elevenSpeed: number;
  mcpBaseUrl: string;
  hasOpenrouterApiKey: boolean;
  hasElevenApiKey: boolean;
  hasMcpToken: boolean;
};

export type AiryApi = {
  ready: () => Promise<{
    ok: boolean;
    error?: string;
    needsSetup?: boolean;
    importedFromEnv?: boolean;
    settings?: AirySettingsView;
  }>;
  getSettings: () => Promise<AirySettingsView>;
  saveSettings: (partial: Record<string, unknown>) => Promise<{
    ok: boolean;
    error?: string;
    settings?: AirySettingsView;
  }>;
  textTurn: (text: string) => Promise<AiryTurn>;
  voiceTurn: (audioBase64: string, filename: string) => Promise<AiryTurn>;
  speak: (text: string) => Promise<{ audioBase64: string }>;
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
};

declare global {
  interface Window {
    airy?: AiryApi;
  }
}

export {};
