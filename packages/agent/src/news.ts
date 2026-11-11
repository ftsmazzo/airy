/** RSS allowlist — G1 e portais públicos. */

export type NewsItem = {
  title: string;
  link?: string;
  source: string;
};

const FEEDS: Record<string, { url: string; label: string }> = {
  g1: { url: "https://g1.globo.com/rss/g1/", label: "G1" },
  "g1-politica": {
    url: "https://g1.globo.com/rss/g1/politica/",
    label: "G1 Política",
  },
  "g1-economia": {
    url: "https://g1.globo.com/rss/g1/economia/",
    label: "G1 Economia",
  },
  uol: { url: "https://rss.uol.com.br/feed/noticias.xml", label: "UOL" },
  bbc: { url: "https://feeds.bbci.co.uk/portuguese/rss.xml", label: "BBC Brasil" },
};

function stripTags(html: string): string {
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssItems(xml: string, source: string, limit: number): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of blocks) {
    const title = stripTags((block.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
    const link = stripTags((block.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || "");
    if (!title) continue;
    items.push({ title, link: link || undefined, source });
    if (items.length >= limit) break;
  }
  return items;
}

export function resolveFeedKey(query: string): string {
  const q = (query || "").toLowerCase();
  if (q.includes("polit")) return "g1-politica";
  if (q.includes("econ")) return "g1-economia";
  if (q.includes("uol")) return "uol";
  if (q.includes("bbc")) return "bbc";
  return "g1";
}

export async function fetchNewsHeadlines(
  portal = "g1",
  limit = 3,
): Promise<{ source: string; items: NewsItem[]; forModel: string }> {
  const key = resolveFeedKey(portal);
  const feed = FEEDS[key] || FEEDS.g1;
  const n = Math.min(5, Math.max(1, Number(limit) || 3));

  const res = await fetch(feed.url, {
    headers: { "User-Agent": "AiryBot/0.1 (+local)" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`RSS ${feed.label} ${res.status}`);
  const xml = await res.text();
  const items = parseRssItems(xml, feed.label, n);
  if (!items.length) {
    return {
      source: feed.label,
      items: [],
      forModel: JSON.stringify({ ok: false, source: feed.label, message: "sem manchetes" }),
    };
  }
  return {
    source: feed.label,
    items,
    forModel: JSON.stringify({
      ok: true,
      source: feed.label,
      headlines: items.map((it) => ({ title: it.title, link: it.link })),
      hint: "Resuma em no máximo 2 frases faladas; cite só 1–3 títulos curtos.",
    }),
  };
}

export const NEWS_TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "read_news",
      description:
        "Lê manchetes recentes via RSS (G1, G1 política/economia, UOL, BBC Brasil). Use quando pedirem notícias.",
      parameters: {
        type: "object",
        properties: {
          portal: {
            type: "string",
            description: "g1 | g1-politica | g1-economia | uol | bbc (default g1)",
          },
          limit: { type: "number", description: "Quantidade 1–5 (default 3)" },
        },
        additionalProperties: false,
      },
    },
  },
];
