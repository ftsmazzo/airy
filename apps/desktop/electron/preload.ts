import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("airy", {
  ready: () => ipcRenderer.invoke("airy:ready") as Promise<{ ok: boolean; error?: string }>,
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
