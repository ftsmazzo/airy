/**
 * Cliente MCP Streamable HTTP mínimo (JSON-RPC) para ie-dados.
 * Usa URL com path-token: /key/<MCP_TOKEN>/mcp
 */

export type McpConfig = {
  baseUrl: string;
  token: string;
};

type JsonRpc = {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
};

export type McpToolInfo = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

export class McpHttpClient {
  private url: string;
  private sessionId: string | null = null;
  private nextId = 1;
  private toolsCache: McpToolInfo[] | null = null;

  constructor(cfg: McpConfig) {
    const base = cfg.baseUrl.replace(/\/$/, "");
    this.url = `${base}/key/${cfg.token}/mcp`;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    };
    if (this.sessionId) h["Mcp-Session-Id"] = this.sessionId;
    return h;
  }

  private parseBody(res: Response, text: string): JsonRpc {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/event-stream") || text.trimStart().startsWith("event:")) {
      const dataLines: string[] = [];
      for (const line of text.split(/\r?\n/)) {
        if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      text = dataLines.join("\n");
    }
    return JSON.parse(text) as JsonRpc;
  }

  async initialize(): Promise<void> {
    const body = {
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "airy", version: "0.1.0" },
      },
    };
    const res = await fetch(this.url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`MCP init ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const sid = res.headers.get("mcp-session-id");
    if (sid) this.sessionId = sid;
    this.parseBody(res, await res.text());

    await fetch(this.url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    });
  }

  async listTools(): Promise<McpToolInfo[]> {
    if (this.toolsCache) return this.toolsCache;
    if (!this.sessionId) await this.initialize();
    const res = await fetch(this.url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: this.nextId++,
        method: "tools/list",
        params: {},
      }),
    });
    if (!res.ok) throw new Error(`MCP tools/list ${res.status}`);
    const rpc = this.parseBody(res, await res.text());
    if (rpc.error) throw new Error(rpc.error.message);
    const result = rpc.result as { tools?: McpToolInfo[] };
    this.toolsCache = result.tools || [];
    return this.toolsCache;
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<string> {
    if (!this.sessionId) await this.initialize();
    const res = await fetch(this.url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: this.nextId++,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
    if (!res.ok) throw new Error(`MCP tools/call ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const rpc = this.parseBody(res, await res.text());
    if (rpc.error) throw new Error(rpc.error.message);
    const result = rpc.result as {
      content?: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };
    const texts = (result.content || [])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!);
    return texts.join("\n") || JSON.stringify(result);
  }
}
