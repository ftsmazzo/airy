/// <reference types="vite/client" />

export type AiryTurn = {
  userText: string;
  assistantText: string;
  audioBase64: string | null;
  toolTrace: string[];
};

export type AiryApi = {
  ready: () => Promise<{ ok: boolean; error?: string }>;
  textTurn: (text: string) => Promise<AiryTurn>;
  voiceTurn: (audioBase64: string, filename: string) => Promise<AiryTurn>;
};

declare global {
  interface Window {
    airy?: AiryApi;
  }
}

export {};
