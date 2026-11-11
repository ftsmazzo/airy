import { synthesizeSpeech, transcribeAudio } from "@airy/voice";
import {
  DESKTOP_TOOL_DEFS,
  openAllowedUrl,
  openRadarMunicipal,
  openSpotify,
  openYoutube,
  type DesktopConfig,
} from "./desktop.js";
import { McpHttpClient } from "./mcp.js";
import {
  buildSystemPrompt,
  clipForSpeech,
  loadIeDadosSkill,
  loadPersona,
} from "./prompt.js";
import { isStopIntent, stopAck } from "./session.js";

export type AiryEnv = {
  openrouterApiKey: string;
  openrouterModel: string;
  elevenApiKey: string;
  elevenVoiceId: string;
  elevenTtsModel?: string;
  elevenStability?: number;
  elevenSimilarity?: number;
  elevenStyle?: number;
  elevenSpeed?: number;
  mcpToken: string;
  mcpBaseUrl: string;
  radarUrl: string;
  personaPath?: string;
  ownerName?: string;
};

function numEnv(value: string | undefined, fallback: number): number {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export type TurnResult = {
  userText: string;
  assistantText: string;
  audioMp3: Buffer | null;
  toolTrace: string[];
};

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

function clean(value: string | undefined): string {
  return (value || "").trim().replace(/^["']|["']$/g, "");
}

export function loadEnvFromProcess(): AiryEnv {
  const e = process.env;
  return {
    openrouterApiKey: clean(e.OPENROUTER_API_KEY),
    openrouterModel: clean(e.OPENROUTER_MODEL) || "anthropic/claude-sonnet-4.5",
    elevenApiKey: clean(e.ELEVENLABS_API_KEY),
    elevenVoiceId: clean(e.ELEVENLABS_VOICE_ID),
    // Prefer ELEVENLABS_MODEL_ID (mesmo nome da conta Pro); fallback legado TTS_MODEL
    elevenTtsModel:
      clean(e.ELEVENLABS_MODEL_ID) ||
      clean(e.ELEVENLABS_TTS_MODEL) ||
      "eleven_multilingual_v2",
    elevenStability: numEnv(e.ELEVENLABS_STABILITY, 0.45),
    elevenSimilarity: numEnv(e.ELEVENLABS_SIMILARITY, 0.75),
    elevenStyle: numEnv(e.ELEVENLABS_STYLE, 0.2),
    elevenSpeed: numEnv(e.ELEVENLABS_SPEED, 1.0),
    mcpToken: clean(e.MCP_TOKEN),
    mcpBaseUrl:
      clean(e.MCP_BASE_URL) || "https://ie-dados-mcp.kxryyk.easypanel.host",
    radarUrl: clean(e.AIRY_RADAR_URL),
    personaPath: clean(e.AIRY_PERSONA_PATH),
    ownerName: clean(e.AIRY_OWNER_NAME),
  };
}

export class AiryAgent {
  private env: AiryEnv;
  private mcp: McpHttpClient;
  private desktop: DesktopConfig;
  private systemPrompt = "";
  private personaPath = "";
  private history: ChatMessage[] = [];
  private mcpToolsOpenAI: Array<{
    type: "function";
    function: { name: string; description?: string; parameters?: Record<string, unknown> };
  }> = [];

  constructor(env: AiryEnv) {
    this.env = env;
    this.mcp = new McpHttpClient({ baseUrl: env.mcpBaseUrl, token: env.mcpToken });
    this.desktop = { radarUrl: env.radarUrl };
    this.reloadPersona();
  }

  /** Recarrega persona/AIRY_PERSONA.md (ou AIRY_PERSONA_PATH). */
  reloadPersona(): { path: string } {
    const persona = loadPersona(this.env.personaPath);
    this.personaPath = persona.path;
    this.systemPrompt = buildSystemPrompt(
      persona.text,
      loadIeDadosSkill(),
      this.env.ownerName || "",
    );
    if (this.history[0]?.role === "system") {
      this.history[0] = { role: "system", content: this.systemPrompt };
    }
    return { path: persona.path };
  }

  getPersonaPath(): string {
    return this.personaPath;
  }

  async ready(): Promise<void> {
    if (!this.env.openrouterApiKey) throw new Error("OPENROUTER_API_KEY ausente");
    if (!this.env.elevenApiKey) throw new Error("ELEVENLABS_API_KEY ausente");
    if (!this.env.mcpToken) throw new Error("MCP_TOKEN ausente");
    await this.mcp.initialize();
    const tools = (await this.mcp.listTools()) || [];
    this.mcpToolsOpenAI = tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description || t.name,
        parameters: (t.inputSchema as Record<string, unknown>) || {
          type: "object",
          properties: {},
        },
      },
    }));
  }

  private allTools() {
    return [...DESKTOP_TOOL_DEFS, ...this.mcpToolsOpenAI];
  }

  private async runDesktopTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    switch (name) {
      case "open_radar_municipal":
        return openRadarMunicipal(this.desktop);
      case "open_youtube":
        return openYoutube();
      case "open_spotify":
        return openSpotify();
      case "open_url":
        return openAllowedUrl(String(args.url || ""), this.desktop);
      default:
        return `Tool desktop desconhecida: ${name}`;
    }
  }

  private async chatCompletion(messages: ChatMessage[]): Promise<{
    message: ChatMessage;
  }> {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.env.openrouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://airy.local",
        "X-Title": "Airy",
      },
      body: JSON.stringify({
        model: this.env.openrouterModel,
        messages,
        tools: this.allTools(),
        tool_choice: "auto",
        temperature: 0.3,
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 500)}`);
    }
    const data = (await res.json()) as {
      choices: Array<{ message: ChatMessage }>;
    };
    return { message: data.choices[0].message };
  }

  private async speak(text: string): Promise<Buffer | null> {
    const clipped = clipForSpeech(text);
    if (!this.env.elevenVoiceId || !clipped) return null;
    try {
      return await synthesizeSpeech(clipped, {
        apiKey: this.env.elevenApiKey,
        voiceId: this.env.elevenVoiceId,
        modelId: this.env.elevenTtsModel,
        stability: this.env.elevenStability,
        similarity: this.env.elevenSimilarity,
        style: this.env.elevenStyle,
        speed: this.env.elevenSpeed,
      });
    } catch {
      return null;
    }
  }

  async handleText(userText: string): Promise<TurnResult> {
    const toolTrace: string[] = [];

    if (isStopIntent(userText)) {
      const assistantText = stopAck(this.env.ownerName);
      return {
        userText,
        assistantText,
        audioMp3: await this.speak(assistantText),
        toolTrace: ["session_stop"],
      };
    }

    if (!this.history.length) {
      this.history.push({ role: "system", content: this.systemPrompt });
    }
    this.history.push({ role: "user", content: userText });

    let guard = 0;
    let finalText = "";

    while (guard++ < 8) {
      const { message } = await this.chatCompletion(this.history);
      this.history.push(message);

      const calls = message.tool_calls || [];
      if (!calls.length) {
        finalText = (message.content || "").trim();
        break;
      }

      for (const call of calls) {
        const name = call.function.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }
        toolTrace.push(name);
        let result: string;
        if (name.startsWith("open_")) {
          result = await this.runDesktopTool(name, args);
        } else {
          result = await this.mcp.callTool(name, args);
        }
        this.history.push({
          role: "tool",
          tool_call_id: call.id,
          name,
          content: result.slice(0, 12000),
        });
      }
    }

    if (!finalText) finalText = "Não consegui montar uma resposta agora.";
    finalText = clipForSpeech(finalText);

    // evita histórico infinito
    if (this.history.length > 40) {
      this.history = [
        this.history[0],
        ...this.history.slice(-30),
      ];
    }

    const audioMp3 = await this.speak(finalText);
    if (!audioMp3 && this.env.elevenVoiceId) toolTrace.push("tts_error");

    return {
      userText,
      assistantText: finalText,
      audioMp3,
      toolTrace,
    };
  }

  async handleAudio(audio: Buffer, filename: string): Promise<TurnResult> {
    const userText = await transcribeAudio(audio, filename, {
      apiKey: this.env.elevenApiKey,
    });
    if (!userText) {
      return {
        userText: "",
        assistantText: "Não entendi o áudio. Pode repetir?",
        audioMp3: null,
        toolTrace: ["stt_empty"],
      };
    }
    return this.handleText(userText);
  }
}

export { McpHttpClient } from "./mcp.js";
export {
  openRadarMunicipal,
  openSpotify,
  openYoutube,
  openAllowedUrl,
} from "./desktop.js";
export {
  loadPersona,
  loadIeDadosSkill,
  buildSystemPrompt,
  clipForSpeech,
} from "./prompt.js";
export { parseOwnerName } from "./name.js";
export { isStopIntent, stopAck } from "./session.js";
