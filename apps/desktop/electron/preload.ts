import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("airy", {
  ready: () =>
    ipcRenderer.invoke("airy:ready") as Promise<{
      ok: boolean;
      error?: string;
      needsSetup?: boolean;
      importedFromEnv?: boolean;
      settings?: Record<string, unknown>;
    }>,
  getSettings: () => ipcRenderer.invoke("airy:settings-get"),
  saveSettings: (partial: Record<string, unknown>) =>
    ipcRenderer.invoke("airy:settings-save", partial) as Promise<{
      ok: boolean;
      error?: string;
      settings?: Record<string, unknown>;
    }>,
  textTurn: (text: string) =>
    ipcRenderer.invoke("airy:text-turn", text) as Promise<{
      userText: string;
      assistantText: string;
      audioBase64: string | null;
      toolTrace: string[];
    }>,
  voiceTurn: (audioBase64: string, filename: string) =>
    ipcRenderer.invoke("airy:voice-turn", { audioBase64, filename }) as Promise<{
      userText: string;
      assistantText: string;
      audioBase64: string | null;
      toolTrace: string[];
    }>,
});
