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
  redeemToken: (token: string) =>
    ipcRenderer.invoke("airy:redeem-token", token) as Promise<{
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
  speak: (text: string) =>
    ipcRenderer.invoke("airy:speak", text) as Promise<{ audioBase64: string }>,
  transcribe: (audioBase64: string, filename: string) =>
    ipcRenderer.invoke("airy:transcribe", { audioBase64, filename }) as Promise<{
      text: string;
    }>,
  enrollName: (audioBase64: string, filename: string) =>
    ipcRenderer.invoke("airy:enroll-name", { audioBase64, filename }) as Promise<{
      ok: boolean;
      name?: string;
      userText: string;
      assistantText: string;
      audioBase64: string | null;
      settings?: Record<string, unknown>;
    }>,
  pickFolder: () =>
    ipcRenderer.invoke("airy:pick-folder") as Promise<
      { ok: true; path: string } | { ok: false }
    >,
  defaultInboxPath: () =>
    ipcRenderer.invoke("airy:default-inbox-path") as Promise<string>,
  onInboxFile: (
    cb: (payload: {
      path: string;
      name: string;
      autoSummarizePdf: boolean;
    }) => void,
  ) => {
    const handler = (
      _evt: unknown,
      payload: { path: string; name: string; autoSummarizePdf: boolean },
    ) => cb(payload);
    ipcRenderer.on("airy:inbox-file", handler);
    return () => ipcRenderer.removeListener("airy:inbox-file", handler);
  },
});
