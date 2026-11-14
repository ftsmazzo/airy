import { synthesizeSpeech, transcribeAudio } from "@airy/voice";
import {
  DESKTOP_TOOL_DEFS,
  openAllowedUrl,
  openNamedApp,
  openRadarMunicipal,
  openSpotify,
  openYoutube,
  type DesktopConfig,
} from "./desktop.js";
import {
  defaultEnabledPackages,
  normalizeEnabledPackages,
  PACKAGE_CATALOG,
  type PackageId,
} from "./packages.js";
import {
  fetchNewsHeadlines,
  NEWS_TOOL_DEFS,
  resolveChannelLiveUrl,
} from "./news.js";
import { ARTIFACT_TOOL_DEFS, createHtmlArtifact } from "./artifacts.js";
import { openPdf, PDF_TOOL_DEFS, summarizePdf } from "./pdf.js";
import { RESEARCH_TOOL_DEFS, researchWeb } from "./research.js";
import {
  forgetMemory,
  MEMORY_TOOL_DEFS,
  memoryPromptBlock,
  recallMemory,
  rememberFact,
} from "./memory.js";
import { NOTES_TOOL_DEFS, saveNote } from "./notes.js";
import { friendlyMcpError, McpHttpClient } from "./mcp.js";
import {
  buildSystemPrompt,
  clipForSpeech,
  loadIeDadosSkill,
  loadPersona,
} from "./prompt.js";
import { friendlyApiError, sanitizeSecret } from "./keys.js";
import { isStopIntent, stopAck } from "./session.js";

export type AiryEnv = {
  openrouterApiKey: string;
  openrouterModel: string;
  /** Default perplexity/sonar — pesquisa web pontual */
  researchModel?: string;
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
  /** Preferir app/PWA instalado do Radar em vez do browser */
  radarOpenAsApp?: boolean;
  radarAppName?: string;
  /** Pacotes ligados nos Ajustes (ids do catálogo) */
  enabledPackages?: PackageId[];
  personaPath?: string;
  ownerName?: string;
  /** Nome pelo qual a IA se apresenta (Ajustes) */
  assistantName?: string;
};

const LOCAL_TOOL_NAMES = new Set([
  "open_radar_municipal",
  "open_youtube",
  "open_spotify",
  "open_url",
  "open_app",
  "open_pdf",
  "read_news",
  "open_channel_live",
  "research_web",
  "create_html_artifact",
  "summarize_pdf",
  "remember_fact",
  "recall_memory",
  "forget_memory",
  "save_note",
]);

function numEnv(value: string | undefined, fallback: number): number {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Confirmação local quando o LLM abre algo e não devolve texto. */
function confirmFromTools(trace: string[], results: string[]): string {
  if (trace.includes("open_radar_municipal")) return "Radar aberto.";
  if (trace.includes("open_youtube")) return "YouTube aberto.";
  if (trace.includes("open_spotify")) return "Spotify aberto.";
  if (trace.includes("open_app")) return "App aberto.";
  if (trace.includes("open_url")) return "Pronto, abri aqui.";
  if (trace.includes("read_news")) {
    const last = results[results.length - 1] || "";
    return last.slice(0, 180) || "Peguei as manchetes.";
  }
  if (trace.includes("open_channel_live")) return "Canal ao vivo aberto.";
  if (trace.includes("create_html_artifact")) return "Relatório HTML aberto.";
  if (trace.includes("open_pdf")) return "PDF aberto.";
  if (trace.includes("save_note")) return "Anotei.";
  if (trace.includes("remember_fact")) return "Lembrei.";
  if (trace.includes("forget_memory")) return "Ok, esqueci.";
  if (
    trace.includes("summarize_pdf") ||
    trace.includes("research_web") ||
    trace.includes("recall_memory")
  ) {
    const last = results[results.length - 1] || "";
    return last.slice(0, 220) || "Pronto.";
  }
  const last = results[results.length - 1] || "";
  if (/aberto|abri|ok/i.test(last)) return "Pronto.";
  return last.slice(0, 160) || "Pronto.";
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
  return sanitizeSecret(value);
}

export function loadEnvFromProcess(): AiryEnv {
  const e = process.env;
  return {
    openrouterApiKey: sanitizeSecret(e.OPENROUTER_API_KEY),
    openrouterModel: clean(e.OPENROUTER_MODEL) || "anthropic/claude-haiku-5.5",
    researchModel: clean(e.AIRY_RESEARCH_MODEL) || "perplexity/sonar",
    elevenApiKey: sanitizeSecret(e.ELEVENLABS_API_KEY),
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
    mcpToken: sanitizeSecret(e.MCP_TOKEN),
    mcpBaseUrl:
      clean(e.MCP_BASE_URL) || "https://ie-dados-mcp.kxryyk.easypanel.host",
    radarUrl: clean(e.AIRY_RADAR_URL),
    radarOpenAsApp: clean(e.AIRY_RADAR_OPEN_AS_APP) === "1",
    radarAppName: clean(e.AIRY_RADAR_APP_NAME) || undefined,
    enabledPackages: defaultEnabledPackages(),
    personaPath: clean(e.AIRY_PERSONA_PATH),
    ownerName: clean(e.AIRY_OWNER_NAME),
    assistantName: clean(e.AIRY_ASSISTANT_NAME) || "Airy",
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
  private mcpStatus: {
    ok: boolean;
    toolCount: number;
    error?: string;
  } = { ok: false, toolCount: 0 };

  constructor(env: AiryEnv) {
    this.env = env;
    this.mcp = new McpHttpClient({ baseUrl: env.mcpBaseUrl, token: env.mcpToken });
    this.desktop = {
      radarUrl: env.radarUrl,
      radarOpenAsApp: Boolean(env.radarOpenAsApp),
      radarAppName: env.radarAppName,
      enabledPackages: normalizeEnabledPackages(env.enabledPackages),
    };
    this.reloadPersona();
  }

  getMcpStatus() {
    return { ...this.mcpStatus };
  }

  /** Recarrega persona/AIRY_PERSONA.md (ou AIRY_PERSONA_PATH). */
  reloadPersona(): { path: string } {
    const persona = loadPersona(this.env.personaPath);
    this.personaPath = persona.path;
    this.systemPrompt = buildSystemPrompt(
      persona.text,
      loadIeDadosSkill(),
      this.env.ownerName || "",
      memoryPromptBlock(12),
      this.env.assistantName || "Airy",
    );
    if (this.history[0]?.role === "system") {
      this.history[0] = { role: "system", content: this.systemPrompt };
    }
    return { path: persona.path };
  }

  /** Atualiza o bloco de memória no system prompt (após remember/forget). */
  refreshMemoryPrompt(): void {
    this.reloadPersona();
  }

  getPersonaPath(): string {
    return this.personaPath;
  }

  async ready(): Promise<void> {
    if (!this.env.openrouterApiKey) throw new Error("OPENROUTER_API_KEY ausente");
    if (!this.env.elevenApiKey) throw new Error("ELEVENLABS_API_KEY ausente");
    if (!this.env.mcpToken) throw new Error("MCP_TOKEN ausente");

    // MCP soft-fail: voz/desktop seguem; dados públicos ficam off até voltar
    try {
      const health = await this.mcp.health();
      if (!health.ok) {
        throw new Error(health.error || "health falhou");
      }
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
      this.mcpStatus = { ok: true, toolCount: tools.length };
    } catch (e) {
      this.mcpToolsOpenAI = [];
      this.mcpStatus = {
        ok: false,
        toolCount: 0,
        error: friendlyMcpError(e),
      };
    }
  }

  private allTools() {
    return [
      ...DESKTOP_TOOL_DEFS,
      ...NEWS_TOOL_DEFS,
      ...RESEARCH_TOOL_DEFS,
      ...ARTIFACT_TOOL_DEFS,
      ...PDF_TOOL_DEFS,
      ...MEMORY_TOOL_DEFS,
      ...NOTES_TOOL_DEFS,
      ...this.mcpToolsOpenAI,
    ];
  }

  private async runLocalTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    switch (name) {
      case "open_radar_municipal":
        return openRadarMunicipal(this.desktop);
      case "open_youtube":
        return openYoutube(this.desktop);
      case "open_spotify":
        return openSpotify(this.desktop);
      case "open_url":
        return openAllowedUrl(String(args.url || ""), this.desktop);
      case "open_app":
        return openNamedApp(String(args.name || ""), this.desktop);
      case "open_pdf":
        return openPdf(String(args.path || ""));
      case "read_news": {
        const news = await fetchNewsHeadlines(
          String(args.portal || "g1"),
          Number(args.limit) || 3,
        );
        return news.forModel;
      }
      case "open_channel_live": {
        const channel = String(args.channel || "");
        const live = resolveChannelLiveUrl(channel);
        if (!live) {
          return `Canal não mapeado: ${channel}. Tente CNN ou GloboNews.`;
        }
        return openAllowedUrl(live, this.desktop);
      }
      case "research_web":
        return researchWeb(String(args.query || ""), {
          openrouterApiKey: this.env.openrouterApiKey,
          researchModel: this.env.researchModel,
        });
      case "create_html_artifact":
        return createHtmlArtifact({
          title: String(args.title || ""),
          subtitle: args.subtitle ? String(args.subtitle) : undefined,
          summary: String(args.summary || ""),
          sections: Array.isArray(args.sections)
            ? (args.sections as Array<{ heading: string; body: string }>)
            : [],
          sources: Array.isArray(args.sources)
            ? args.sources.map(String)
            : [],
        });
      case "summarize_pdf":
        return summarizePdf(
          String(args.path || ""),
          {
            openrouterApiKey: this.env.openrouterApiKey,
            openrouterModel: this.env.openrouterModel,
          },
          args.focus ? String(args.focus) : undefined,
        );
      case "remember_fact": {
        const out = rememberFact(
          String(args.text || ""),
          Array.isArray(args.tags) ? args.tags.map(String) : [],
        );
        this.refreshMemoryPrompt();
        return out;
      }
      case "recall_memory":
        return recallMemory(String(args.query || ""), Number(args.limit) || 8);
      case "forget_memory": {
        const out = forgetMemory(String(args.query || ""));
        this.refreshMemoryPrompt();
        return out;
      }
      case "save_note":
        return saveNote(String(args.title || ""), String(args.body || ""));
      default:
        return `Tool local desconhecida: ${name}`;
    }
  }

  private async chatCompletion(
    messages: ChatMessage[],
    opts?: { tools?: boolean },
  ): Promise<{ message: ChatMessage }> {
    const useTools = opts?.tools !== false;
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
        temperature: 0.3,
        ...(useTools
          ? { tools: this.allTools(), tool_choice: "auto" }
          : { tool_choice: "none" }),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(friendlyApiError("OpenRouter", res.status, body));
    }
    const data = (await res.json()) as {
      choices: Array<{ message: ChatMessage }>;
    };
    return { message: data.choices[0]?.message || { role: "assistant", content: "" } };
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
    const toolResults: string[] = [];

    while (guard++ < 8) {
      const { message } = await this.chatCompletion(this.history);
      this.history.push(message);

      const calls = message.tool_calls || [];
      const content = (message.content || "").trim();
      if (content) finalText = content;

      if (!calls.length) {
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
        if (LOCAL_TOOL_NAMES.has(name)) {
          result = await this.runLocalTool(name, args);
        } else if (!this.mcpStatus.ok) {
          result =
            this.mcpStatus.error ||
            "MCP offline. Dados públicos indisponíveis; tente de novo depois.";
        } else {
          try {
            result = await this.mcp.callTool(name, args);
          } catch (e) {
            result = friendlyMcpError(e);
          }
        }
        toolResults.push(result);
        this.history.push({
          role: "tool",
          tool_call_id: call.id,
          name,
          content: result.slice(0, 12000),
        });
      }
    }

    // Modelos às vezes fecham o turno de tool com content vazio (comum após open_*).
    if (!finalText && toolTrace.length) {
      try {
        this.history.push({
          role: "user",
          content: "Confirme em UMA frase curta o que acabou de fazer. Sem tools.",
        });
        const { message } = await this.chatCompletion(this.history, { tools: false });
        this.history.push(message);
        finalText = (message.content || "").trim();
      } catch {
        /* cai no fallback local */
      }
    }

    if (!finalText) finalText = confirmFromTools(toolTrace, toolResults);
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
  PACKAGE_CATALOG,
  defaultEnabledPackages,
  normalizeEnabledPackages,
  type PackageId,
  type PackageDef,
} from "./packages.js";
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
export { sanitizeSecret, looksLikeOpenRouterKey, looksLikeElevenKey } from "./keys.js";
