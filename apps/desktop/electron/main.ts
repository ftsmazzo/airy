import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  screen,
  session,
  systemPreferences,
} from "electron";
import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AiryAgent,
  loadEnvFromProcess,
  parseOwnerName,
  type AiryEnv,
} from "@airy/agent";
import { synthesizeSpeech, transcribeAudio } from "@airy/voice";
import {
  clearLicensedSecrets,
  importFromEnvIfEmpty,
  loadSettings,
  saveSettings,
  settingsPublicView,
  settingsToAiryEnv,
  type SettingsForm,
} from "./secureConfig.js";
import {
  defaultInboxPath,
  ensureInboxDir,
  startInboxWatch,
  stopInboxWatch,
} from "./inboxWatch.js";
import { redeemInstallToken, validateLicenseToken } from "./redeemToken.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFiles() {
  const roots = [
    join(process.cwd(), ".env"),
    join(process.cwd(), "..", "..", ".env"),
    join(__dirname, "../../../.env"),
    join(__dirname, "../../../../.env"),
  ];
  for (const p of roots) {
    if (existsSync(p)) loadDotenv({ path: p, override: false });
  }
}

loadEnvFiles();

/** Persona/skills no pacote instalado (extraResources). */
function applyPackagedResourcePaths(): void {
  if (!app.isPackaged) return;
  const persona = join(process.resourcesPath, "persona", "AIRY_PERSONA.md");
  if (existsSync(persona) && !process.env.AIRY_PERSONA_PATH) {
    process.env.AIRY_PERSONA_PATH = persona;
  }
}

applyPackagedResourcePaths();

let mainWindow: BrowserWindow | null = null;
let agent: AiryAgent | null = null;
let bootEnv: AiryEnv = loadEnvFromProcess();

function resolveEnv(): AiryEnv {
  const settings = loadSettings();
  return settingsToAiryEnv(settings, bootEnv);
}

function applyInboxWatch(): void {
  const s = loadSettings();
  const path = s.inboxPath?.trim() || defaultInboxPath();
  if (s.inboxEnabled) ensureInboxDir(path);
  startInboxWatch(mainWindow, {
    enabled: Boolean(s.inboxEnabled),
    path,
    autoSummarizePdf: Boolean(s.inboxAutoSummarizePdf),
  });
}

async function ensureMicAccess(): Promise<void> {
  if (process.platform !== "darwin") return;
  try {
    const status = systemPreferences.getMediaAccessStatus("microphone");
    if (status !== "granted") {
      await systemPreferences.askForMediaAccess("microphone");
    }
  } catch {
    /* ok */
  }
}

function resolveAppIcon(): string | undefined {
  const candidates = [
    join(__dirname, "../assets/icon.png"),
    join(__dirname, "../assets/icon.jpg"),
    join(__dirname, "../../../apps/desktop/assets/icon.png"),
    join(process.cwd(), "apps/desktop/assets/icon.png"),
    join(process.cwd(), "assets/icon.png"),
  ];
  return candidates.find((p) => existsSync(p));
}

function resolvePreload(): string {
  const candidates = [
    join(__dirname, "preload.cjs"),
    join(__dirname, "preload.js"),
    join(__dirname, "preload.mjs"),
  ];
  const hit = candidates.find((p) => existsSync(p));
  if (!hit) throw new Error(`Preload não encontrado em ${__dirname}`);
  return hit;
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const icon = resolveAppIcon();
  const isWin = process.platform === "win32";

  mainWindow = new BrowserWindow({
    width,
    height,
    x: display.workArea.x,
    y: display.workArea.y,
    // Windows: maximizado com frame. Mac: fullscreen sem borda.
    fullscreen: !isWin,
    simpleFullscreen: process.platform === "darwin",
    frame: isWin,
    transparent: false,
    backgroundColor: "#02040a",
    title: "Airy",
    autoHideMenuBar: true,
    show: false,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: resolvePreload(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  if (isWin) {
    mainWindow.maximize();
    mainWindow.setMinimumSize(900, 600);
  }
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    applyInboxWatch();
  });
  mainWindow.on("closed", () => {
    stopInboxWatch();
    mainWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }
}

/** Cache curto de validate — evita bater na VPS a cada frase. */
let licenseCache: { token: string; ok: boolean; checkedAt: number; error?: string } | null =
  null;
const LICENSE_TTL_MS = 5 * 60_000;

async function ensureLicense(): Promise<void> {
  const skip = (process.env.AIRY_SKIP_LICENSE || "").trim() === "1";
  if (skip) return;

  const s = loadSettings();
  const token = (s.licenseToken || "").trim();
  if (!token) {
    throw new Error("Token de instalação ausente — cole o token em Ajustes");
  }

  const now = Date.now();
  if (
    licenseCache &&
    licenseCache.token === token &&
    now - licenseCache.checkedAt < LICENSE_TTL_MS
  ) {
    if (licenseCache.ok) return;
    throw new Error(licenseCache.error || "Token inválido");
  }

  const result = await validateLicenseToken(token);
  if (!result.ok) {
    licenseCache = {
      token,
      ok: false,
      checkedAt: now,
      error: result.error,
    };
    if (result.revokeLocal) {
      clearLicensedSecrets();
    }
    resetAgent();
    throw new Error(
      result.error || "Token inválido ou revogado — peça um novo à Fábrica",
    );
  }
  licenseCache = { token, ok: true, checkedAt: now };
}

async function getAgent(): Promise<AiryAgent> {
  await ensureLicense();
  if (agent) return agent;
  const env = resolveEnv();
  const missing: string[] = [];
  if (!env.openrouterApiKey) missing.push("OpenRouter");
  if (!env.elevenApiKey) missing.push("ElevenLabs");
  if (!env.elevenVoiceId) missing.push("Voice ID");
  if (!env.mcpToken) missing.push("MCP");
  if (missing.length) {
    throw new Error(
      `Config incompleta (${missing.join(", ")}) — tecla , para Ajustes`,
    );
  }
  agent = new AiryAgent(env);
  await agent.ready();
  return agent;
}

function resetAgent() {
  agent = null;
  licenseCache = null;
}

function packTurn(turn: {
  userText: string;
  assistantText: string;
  audioMp3: Buffer | null;
  toolTrace: string[];
}) {
  return {
    userText: turn.userText,
    assistantText: turn.assistantText,
    audioBase64: turn.audioMp3 ? turn.audioMp3.toString("base64") : null,
    toolTrace: turn.toolTrace,
  };
}

app.whenReady().then(async () => {
  bootEnv = loadEnvFromProcess();
  const imported = importFromEnvIfEmpty(bootEnv);
  if (imported) {
    console.log("[airy] .env importado para o cofre local (userData)");
  }

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    // Electron tipa Permission sem "microphone" em algumas versões; runtime ainda pede.
    const p = permission as string;
    if (p === "media" || p === "microphone") {
      callback(true);
      return;
    }
    callback(false);
  });

  await ensureMicAccess();
  createWindow();

  globalShortcut.register("F11", () => {
    if (!mainWindow) return;
    const next = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(next);
    if (process.platform === "darwin") mainWindow.setSimpleFullScreen(next);
  });

  // Sai de verdade (atalho Windows que “sumia” ao fechar o terminal)
  globalShortcut.register(process.platform === "darwin" ? "Command+Q" : "Control+Q", () => {
    app.quit();
  });

  ipcMain.handle("airy:ready", async () => {
    try {
      const view = settingsPublicView(loadSettings());
      if (!view.configured) {
        return {
          ok: false,
          needsSetup: true,
          error: view.missing.includes("TOKEN")
            ? "Cole o token de instalação para liberar a Airy"
            : `Falta configurar: ${view.missing.join(", ")}`,
          settings: view,
        };
      }
      const a = await getAgent();
      const mcp = a.getMcpStatus();
      return {
        ok: true,
        settings: settingsPublicView(loadSettings()),
        importedFromEnv: imported,
        mcp,
      };
    } catch (e) {
      return {
        ok: false,
        needsSetup: true,
        error: (e as Error).message,
        settings: settingsPublicView(loadSettings()),
      };
    }
  });

  ipcMain.handle("airy:settings-get", async () => {
    const view = settingsPublicView(loadSettings());
    try {
      if (agent) {
        return { ...view, mcp: agent.getMcpStatus() };
      }
    } catch {
      /* ignore */
    }
    return view;
  });

  ipcMain.handle("airy:redeem-token", async (_evt, token: string) => {
    try {
      const result = await redeemInstallToken(String(token || ""));
      if (!result.ok) return { ok: false, error: result.error };
      saveSettings(result.partial);
      resetAgent();
      try {
        await getAgent();
      } catch (e) {
        return {
          ok: false,
          error: `Token ok, mas agent falhou: ${(e as Error).message}`,
          settings: settingsPublicView(loadSettings()),
        };
      }
      applyInboxWatch();
      return { ok: true, settings: settingsPublicView(loadSettings()) };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  ipcMain.handle("airy:settings-save", async (_evt, partial: Partial<SettingsForm>) => {
    try {
      const cur = loadSettings();
      const clean: Partial<SettingsForm> = { ...partial };
      if (clean.openrouterApiKey === "") delete clean.openrouterApiKey;
      if (clean.elevenApiKey === "") delete clean.elevenApiKey;
      if (clean.mcpToken === "") delete clean.mcpToken;
      if (clean.licenseToken === "") delete clean.licenseToken;
      // Keys manuais sem token não liberam o app
      if (!cur.licenseToken && !clean.licenseToken) {
        return {
          ok: false,
          error: "É preciso um token de instalação válido antes de salvar as keys",
          settings: settingsPublicView(cur),
        };
      }
      saveSettings({ ...cur, ...clean });
      resetAgent();
      await getAgent();
      applyInboxWatch();
      return { ok: true, settings: settingsPublicView(loadSettings()) };
    } catch (e) {
      return {
        ok: false,
        error: (e as Error).message,
        settings: settingsPublicView(loadSettings()),
      };
    }
  });

  ipcMain.handle("airy:pick-folder", async () => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: "Pasta vigiada da Airy",
      properties: ["openDirectory", "createDirectory"],
      defaultPath: loadSettings().inboxPath || defaultInboxPath(),
    });
    if (res.canceled || !res.filePaths[0]) return { ok: false as const };
    return { ok: true as const, path: res.filePaths[0] };
  });

  ipcMain.handle("airy:default-inbox-path", async () => defaultInboxPath());

  const refocusAiry = () => {
    // No Mac, `open` do Radar/URL rouba o foco pro browser — parece que o Airy “travou”.
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  };

  ipcMain.handle("airy:text-turn", async (_evt, text: string) => {
    try {
      const a = await getAgent();
      const turn = await a.handleText(String(text || ""));
      return packTurn(turn);
    } finally {
      refocusAiry();
    }
  });

  ipcMain.handle(
    "airy:voice-turn",
    async (_evt, payload: { audioBase64: string; filename: string }) => {
      try {
        await ensureMicAccess();
        const a = await getAgent();
        const buf = Buffer.from(payload.audioBase64, "base64");
        const turn = await a.handleAudio(buf, payload.filename || "audio.webm");
        return packTurn(turn);
      } finally {
        refocusAiry();
      }
    },
  );

  ipcMain.handle(
    "airy:speak",
    async (_evt, text: string, opts?: { voiceId?: string }) => {
      await ensureLicense();
      const env = resolveEnv();
      const voiceId = (opts?.voiceId || env.elevenVoiceId || "").trim();
      if (!env.elevenApiKey || !voiceId) {
        throw new Error("ElevenLabs não configurado");
      }
      const audioMp3 = await synthesizeSpeech(String(text || "").slice(0, 400), {
        apiKey: env.elevenApiKey,
        voiceId,
        modelId: env.elevenTtsModel,
        stability: env.elevenStability,
        similarity: env.elevenSimilarity,
        style: env.elevenStyle,
        speed: env.elevenSpeed,
      });
      return { audioBase64: audioMp3.toString("base64") };
    },
  );

  /** STT só — wake por “Airy …” sem rodar o agente. */
  ipcMain.handle(
    "airy:transcribe",
    async (_evt, payload: { audioBase64: string; filename: string }) => {
      await ensureLicense();
      await ensureMicAccess();
      const env = resolveEnv();
      if (!env.elevenApiKey) throw new Error("ElevenLabs não configurado");
      const buf = Buffer.from(payload.audioBase64, "base64");
      const text = await transcribeAudio(buf, payload.filename || "wake.webm", {
        apiKey: env.elevenApiKey,
      });
      return { text: text || "" };
    },
  );

  /** Primeira ativação: ouve o nome, grava no cofre local, confirma. */
  ipcMain.handle(
    "airy:enroll-name",
    async (_evt, payload: { audioBase64: string; filename: string }) => {
      await ensureLicense();
      await ensureMicAccess();
      const env = resolveEnv();
      const buf = Buffer.from(payload.audioBase64, "base64");
      const userText = await transcribeAudio(buf, payload.filename || "audio.webm", {
        apiKey: env.elevenApiKey,
      });
      const name = parseOwnerName(userText);
      if (!name) {
        const retry = "Não peguei o nome. Pode repetir só o nome?";
        const audioMp3 = await synthesizeSpeech(retry, {
          apiKey: env.elevenApiKey,
          voiceId: env.elevenVoiceId,
          modelId: env.elevenTtsModel,
          stability: env.elevenStability,
          similarity: env.elevenSimilarity,
          style: env.elevenStyle,
          speed: env.elevenSpeed,
        });
        return {
          ok: false,
          userText,
          assistantText: retry,
          audioBase64: audioMp3.toString("base64"),
          settings: settingsPublicView(loadSettings()),
        };
      }

      saveSettings({ ...loadSettings(), ownerName: name });
      resetAgent();
      // recria agente com o nome na persona
      try {
        await getAgent();
      } catch {
        /* keys podem estar ok mesmo assim */
      }

      const ack = `Prazer, ${name}. Duas palmas quando precisar.`;
      const audioMp3 = await synthesizeSpeech(ack, {
        apiKey: env.elevenApiKey,
        voiceId: env.elevenVoiceId,
        modelId: env.elevenTtsModel,
        stability: env.elevenStability,
        similarity: env.elevenSimilarity,
        style: env.elevenStyle,
        speed: env.elevenSpeed,
      });
      return {
        ok: true,
        name,
        userText,
        assistantText: ack,
        audioBase64: audioMp3.toString("base64"),
        settings: settingsPublicView(loadSettings()),
      };
    },
  );

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  stopInboxWatch();
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
