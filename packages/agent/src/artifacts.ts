import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ArtifactSection = {
  heading: string;
  body: string;
};

export type ArtifactInput = {
  title: string;
  subtitle?: string;
  summary: string;
  sections?: ArtifactSection[];
  sources?: string[];
};

export const ARTIFACT_TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "create_html_artifact",
      description:
        "Gera um relatório HTML premium local (levantamento de produto/oferta/técnico), salva em ~/Airy/artifacts e abre no navegador. Use após research_web ou com conteúdo já reunido.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          subtitle: { type: "string" },
          summary: {
            type: "string",
            description: "Resumo técnico executivo (1–3 parágrafos).",
          },
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                heading: { type: "string" },
                body: { type: "string" },
              },
              required: ["heading", "body"],
            },
          },
          sources: {
            type: "array",
            items: { type: "string" },
            description: "URLs ou referências",
          },
        },
        required: ["title", "summary"],
        additionalProperties: false,
      },
    },
  },
];

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(s: string): string {
  return (s || "airy")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "airy";
}

function renderHtml(input: ArtifactInput): string {
  const sections = input.sections || [];
  const sources = input.sources || [];
  const when = new Date().toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const sectionHtml = sections
    .map(
      (s) => `
      <section class="block">
        <h2>${esc(s.heading)}</h2>
        <p>${esc(s.body).replace(/\n+/g, "</p><p>")}</p>
      </section>`,
    )
    .join("\n");

  const sourcesHtml =
    sources.length > 0
      ? `<section class="block sources">
        <h2>Fontes</h2>
        <ul>${sources.map((u) => `<li><a href="${esc(u)}" target="_blank" rel="noreferrer">${esc(u)}</a></li>`).join("")}</ul>
      </section>`
      : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(input.title)} · Airy</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #070b12;
      --bg2: #0d1522;
      --fg: #e8f0f7;
      --muted: #8aa0b5;
      --line: rgba(232,240,247,0.12);
      --accent: #3ecbff;
      --accent2: #5cffd2;
      --amber: #ff9a4d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--fg);
      font-family: Manrope, system-ui, sans-serif;
      background:
        radial-gradient(ellipse 80% 50% at 10% -10%, rgba(62,203,255,0.16), transparent 55%),
        radial-gradient(ellipse 60% 40% at 90% 0%, rgba(255,154,77,0.08), transparent 50%),
        linear-gradient(180deg, var(--bg2), var(--bg));
    }
    .wrap {
      max-width: 880px;
      margin: 0 auto;
      padding: 56px 28px 80px;
    }
    .brand {
      font-size: 12px;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--accent);
      font-weight: 600;
      margin-bottom: 18px;
    }
    h1 {
      font-family: "Instrument Serif", Georgia, serif;
      font-weight: 400;
      font-size: clamp(36px, 6vw, 56px);
      line-height: 1.08;
      margin: 0 0 12px;
      letter-spacing: -0.02em;
    }
    .sub {
      color: var(--muted);
      font-size: 16px;
      margin: 0 0 28px;
      max-width: 42rem;
    }
    .meta {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      font-size: 12px;
      color: var(--muted);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      padding: 14px 0;
      margin-bottom: 36px;
    }
    .summary {
      font-size: 18px;
      line-height: 1.55;
      margin: 0 0 40px;
      max-width: 40rem;
    }
    .block {
      margin: 0 0 28px;
      padding: 22px 0 0;
      border-top: 1px solid var(--line);
    }
    .block h2 {
      font-size: 13px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--accent2);
      margin: 0 0 12px;
      font-weight: 600;
    }
    .block p {
      margin: 0 0 10px;
      color: #d5e3ef;
      line-height: 1.55;
      font-size: 15px;
    }
    .sources ul {
      margin: 0;
      padding-left: 1.1rem;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.6;
    }
    .sources a { color: var(--accent); text-decoration: none; }
    .sources a:hover { text-decoration: underline; }
    footer {
      margin-top: 48px;
      font-size: 12px;
      color: var(--muted);
      letter-spacing: 0.08em;
    }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="brand">Airy · Artefato</div>
    <h1>${esc(input.title)}</h1>
    ${input.subtitle ? `<p class="sub">${esc(input.subtitle)}</p>` : ""}
    <div class="meta">
      <span>Gerado ${esc(when)}</span>
      <span>Resumo técnico</span>
    </div>
    <p class="summary">${esc(input.summary).replace(/\n+/g, "</p><p class=\"summary\">")}</p>
    ${sectionHtml}
    ${sourcesHtml}
    <footer>AIRY — AGENTE DO FUTURO</footer>
  </main>
</body>
</html>`;
}

async function openLocalFile(filePath: string): Promise<void> {
  if (process.platform === "darwin") {
    await execFileAsync("open", [filePath]);
  } else if (process.platform === "win32") {
    await execFileAsync("cmd", ["/c", "start", "", filePath]);
  } else {
    await execFileAsync("xdg-open", [filePath]);
  }
}

export async function createHtmlArtifact(input: ArtifactInput): Promise<string> {
  const title = (input.title || "").trim();
  const summary = (input.summary || "").trim();
  if (!title || !summary) return "title e summary são obrigatórios.";

  const dir = join(homedir(), "Airy", "artifacts");
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = join(dir, `${stamp}-${slug(title)}.html`);
  const html = renderHtml({
    title,
    subtitle: input.subtitle,
    summary,
    sections: input.sections || [],
    sources: input.sources || [],
  });
  await writeFile(file, html, "utf8");
  try {
    await openLocalFile(file);
  } catch (e) {
    return `Artefato salvo em ${file}, mas não abri o browser: ${(e as Error).message}`;
  }
  return `Artefato HTML aberto: ${file}`;
}
