/**
 * Várias conexões MCP HTTP (path-token), tools agregadas com prefixo.
 * Tokens nunca logados.
 */
import { friendlyMcpError, McpHttpClient, type McpToolInfo } from "./mcp.js";

export type McpConnectionPublic = {
  id: string;
  label: string;
  baseUrl: string;
  enabled: boolean;
};

export type McpConnectionSecret = {
  id: string;
  token: string;
};

export type McpConnectionFull = McpConnectionPublic & { token: string };

export type OpenAiToolDef = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

const TOOL_PREFIX = "mcp__";

export function mcpToolName(connId: string, toolName: string): string {
  const safeConn = (connId || "x").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  const safeTool = (toolName || "tool").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return `${TOOL_PREFIX}${safeConn}__${safeTool}`;
}

export function parseMcpToolName(
  name: string,
): { connId: string; toolName: string } | null {
  if (!name.startsWith(TOOL_PREFIX)) return null;
  const rest = name.slice(TOOL_PREFIX.length);
  const idx = rest.indexOf("__");
  if (idx <= 0) return null;
  return { connId: rest.slice(0, idx), toolName: rest.slice(idx + 2) };
}

function assertHttpsUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return "URL MCP deve ser http(s)";
    }
    // produção: preferir https (aviso só se http)
    return null;
  } catch {
    return "URL MCP inválida";
  }
}

export function normalizeMcpConnections(
  publicList: McpConnectionPublic[] | undefined,
  tokens: McpConnectionSecret[] | undefined,
  legacy?: { baseUrl?: string; token?: string },
): McpConnectionFull[] {
  const tokenMap = new Map(
    (tokens || []).map((t) => [t.id, (t.token || "").trim()]),
  );
  let list = Array.isArray(publicList) ? [...publicList] : [];

  if (!list.length && legacy?.token) {
    list = [
      {
        id: "ie-dados",
        label: "ie-dados",
        baseUrl:
          (legacy.baseUrl || "").trim() ||
          "https://ie-dados-mcp.kxryyk.easypanel.host",
        enabled: true,
      },
    ];
    if (!tokenMap.has("ie-dados")) {
      tokenMap.set("ie-dados", legacy.token.trim());
    }
  }

  return list
    .map((c) => ({
      id: String(c.id || "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 32),
      label: String(c.label || c.id || "MCP").trim().slice(0, 80),
      baseUrl: String(c.baseUrl || "").trim().replace(/\/$/, ""),
      enabled: c.enabled !== false,
      token: tokenMap.get(String(c.id || "").trim()) || "",
    }))
    .filter((c) => c.id && c.baseUrl);
}

export class McpHub {
  private clients = new Map<string, McpHttpClient>();
  private toolRoute = new Map<string, { connId: string; toolName: string }>();
  private toolsOpenAI: OpenAiToolDef[] = [];
  private status: {
    ok: boolean;
    toolCount: number;
    connections: Array<{ id: string; label: string; ok: boolean; toolCount: number; error?: string }>;
    error?: string;
  } = { ok: false, toolCount: 0, connections: [] };

  getStatus() {
    return { ...this.status, connections: [...this.status.connections] };
  }

  getTools(): OpenAiToolDef[] {
    return this.toolsOpenAI;
  }

  async ready(connections: McpConnectionFull[]): Promise<void> {
    this.clients.clear();
    this.toolRoute.clear();
    this.toolsOpenAI = [];
    const reports: typeof this.status.connections = [];

    const enabled = connections.filter((c) => c.enabled && c.token);
    if (!enabled.length) {
      this.status = {
        ok: false,
        toolCount: 0,
        connections: [],
        error: "Nenhuma conexão MCP ativa (adicione em Ajustes)",
      };
      return;
    }

    for (const c of enabled) {
      const urlErr = assertHttpsUrl(c.baseUrl);
      if (urlErr) {
        reports.push({
          id: c.id,
          label: c.label,
          ok: false,
          toolCount: 0,
          error: urlErr,
        });
        continue;
      }
      const client = new McpHttpClient({ baseUrl: c.baseUrl, token: c.token });
      try {
        const health = await client.health();
        if (!health.ok) throw new Error(health.error || "health falhou");
        await client.initialize();
        const tools = (await client.listTools()) || [];
        this.clients.set(c.id, client);
        for (const t of tools) {
          const fullName = mcpToolName(c.id, t.name);
          this.toolRoute.set(fullName, { connId: c.id, toolName: t.name });
          // também aceita nome cru se só houver 1 conexão (legado)
          if (enabled.length === 1) {
            this.toolRoute.set(t.name, { connId: c.id, toolName: t.name });
          }
          this.toolsOpenAI.push({
            type: "function",
            function: {
              name: fullName,
              description: `[${c.label}] ${t.description || t.name}`,
              parameters: (t.inputSchema as Record<string, unknown>) || {
                type: "object",
                properties: {},
              },
            },
          });
        }
        reports.push({
          id: c.id,
          label: c.label,
          ok: true,
          toolCount: tools.length,
        });
      } catch (e) {
        reports.push({
          id: c.id,
          label: c.label,
          ok: false,
          toolCount: 0,
          error: friendlyMcpError(e),
        });
      }
    }

    const okAny = reports.some((r) => r.ok);
    this.status = {
      ok: okAny,
      toolCount: this.toolsOpenAI.length,
      connections: reports,
      error: okAny
        ? undefined
        : reports.map((r) => r.error).filter(Boolean)[0] || "MCP offline",
    };
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const route =
      this.toolRoute.get(name) ||
      parseMcpToolName(name) ||
      null;
    if (!route) {
      return `Tool MCP desconhecida: ${name}`;
    }
    const client = this.clients.get(route.connId);
    if (!client) {
      return `Conexão MCP “${route.connId}” offline.`;
    }
    try {
      return await client.callTool(route.toolName, args);
    } catch (e) {
      return friendlyMcpError(e);
    }
  }
}

export type { McpToolInfo };
