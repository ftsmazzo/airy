import { app, BrowserWindow, ipcMain } from "electron";
import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AiryAgent, loadEnvFromProcess } from "@airy/agent";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFiles() {
  const roots = [
    join(process.cwd(), ".env"),
    join(process.cwd(), "..", "..", ".env"),
    join(__dirname, "../../../.env"),
  ];
  for (const p of roots) {
    if (existsSync(p)) loadDotenv({ path: p, override: false });
  }
}

loadEnvFiles();

let mainWindow: BrowserWindow | null = null;
let agent: AiryAgent | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 720,
    backgroundColor: "#070b14",
    title: "Airy",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }
}

async function getAgent(): Promise<AiryAgent> {
  if (agent) return agent;
  const env = loadEnvFromProcess();
  agent = new AiryAgent(env);
  await agent.ready();
  return agent;
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

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle("airy:ready", async () => {
    try {
      await getAgent();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
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
      const a = await getAgent();
      const buf = Buffer.from(payload.audioBase64, "base64");
      const turn = await a.handleAudio(buf, payload.filename || "audio.webm");
      return packTurn(turn);
    },
  );

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
