import {
  app,
  BrowserWindow,
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
  importFromEnvIfEmpty,
  loadSettings,
  saveSettings,
  settingsPublicView,
  settingsToAiryEnv,
  type SettingsForm,
} from "./secureConfig.js";

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

let mainWindow: BrowserWindow | null = null;
let agent: AiryAgent | null = null;
let bootEnv: AiryEnv = loadEnvFromProcess();

function resolveEnv(): AiryEnv {
  const settings = loadSettings();
  return settingsToAiryEnv(settings, bootEnv);
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

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    x: display.workArea.x,
    y: display.workArea.y,
    fullscreen: true,
    simpleFullscreen: process.platform === "darwin",
    frame: false,
    transparent: false,
    backgroundColor: "#02040a",
    title: "Airy",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }
}

async function getAgent(): Promise<AiryAgent> {
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
    if (permission === "media" || permission === "microphone") {
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

  ipcMain.handle("airy:ready", async () => {
    try {
      const view = settingsPublicView(loadSettings());
      if (!view.configured) {
        // ainda tenta .env legado
        const env = resolveEnv();
        if (env.openrouterApiKey && env.elevenApiKey && env.mcpToken && env.elevenVoiceId) {
          await getAgent();
          return { ok: true, settings: settingsPublicView(loadSettings()), importedFromEnv: imported };
        }
        return {
          ok: false,
          needsSetup: true,
          error: `Falta configurar: ${view.missing.join(", ")}`,
          settings: view,
        };
      }
      await getAgent();
      return { ok: true, settings: view, importedFromEnv: imported };
    } catch (e) {
      return {
        ok: false,
        error: (e as Error).message,
        settings: settingsPublicView(loadSettings()),
      };
    }
  });

  ipcMain.handle("airy:settings-get", async () => settingsPublicView(loadSettings()));

  ipcMain.handle("airy:settings-save", async (_evt, partial: Partial<SettingsForm>) => {
    try {
      // não sobrescrever segredo com string vazia (campo mascarado na UI)
      const cur = loadSettings();
      const clean: Partial<SettingsForm> = { ...partial };
      if (clean.openrouterApiKey === "") delete clean.openrouterApiKey;
      if (clean.elevenApiKey === "") delete clean.elevenApiKey;
      if (clean.mcpToken === "") delete clean.mcpToken;
      saveSettings({ ...cur, ...clean });
      resetAgent();
      await getAgent();
      return { ok: true, settings: settingsPublicView(loadSettings()) };
    } catch (e) {
      return { ok: false, error: (e as Error).message, settings: settingsPublicView(loadSettings()) };
    }
  });

  ipcMain.handle("airy:text-turn", async (_evt, text: string) => {
    const a = await getAgent();
    const turn = await a.handleText(String(text || ""));
    return packTurn(turn);
  });

  ipcMain.handle(
    "airy:voice-turn",
    async (_evt, payload: { audioBase64: string; filename: string }) => {
      await ensureMicAccess();
      const a = await getAgent();
      const buf = Buffer.from(payload.audioBase64, "base64");
      const turn = await a.handleAudio(buf, payload.filename || "audio.webm");
      return packTurn(turn);
    },
  );

  ipcMain.handle("airy:speak", async (_evt, text: string) => {
    const env = resolveEnv();
    if (!env.elevenApiKey || !env.elevenVoiceId) {
      throw new Error("ElevenLabs não configurado");
    }
    const audioMp3 = await synthesizeSpeech(String(text || "").slice(0, 400), {
      apiKey: env.elevenApiKey,
      voiceId: env.elevenVoiceId,
      modelId: env.elevenTtsModel,
      stability: env.elevenStability,
      similarity: env.elevenSimilarity,
      style: env.elevenStyle,
      speed: env.elevenSpeed,
    });
    return { audioBase64: audioMp3.toString("base64") };
  });

  /** Primeira ativação: ouve o nome, grava no cofre local, confirma. */
  ipcMain.handle(
    "airy:enroll-name",
    async (_evt, payload: { audioBase64: string; filename: string }) => {
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
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
