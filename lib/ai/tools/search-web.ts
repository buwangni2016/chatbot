import { tool } from "ai";
import { z } from "zod";

// Parse Google News RSS XML into articles
function parseRSS(xml: string): Array<{ title: string; source: string; date: string; link: string }> {
  const items: Array<{ title: string; source: string; date: string; link: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
    const block = match[1];
    const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ??
                   block.match(/<title>(.*?)<\/title>/))?.[1] ?? "";
    const source = (block.match(/<source[^>]*>(.*?)<\/source>/))?.[1] ?? "";
    const date = (block.match(/<pubDate>(.*?)<\/pubDate>/))?.[1] ?? "";
    const link = (block.match(/<link>(.*?)<\/link>/) ??
                  block.match(/<link\s+href="(.*?)"/))?.[1] ?? "";
    if (title) items.push({ title, source, date: date.slice(0, 25), link });
  }
  return items;
}

// Search Google News RSS (free, no key, real-time)
async function searchGoogleNews(query: string, lang = "zh-CN") {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${lang}&gl=CN&ceid=CN:zh-Hans`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; chatbot/1.0)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  return parseRSS(xml);
}

// DuckDuckGo for factual/encyclopedic queries
async function searchDDG(query: string) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "chatbot/1.0" },
    signal: AbortSignal.timeout(6000),
  });
  const data = await res.json() as any;
  const parts: string[] = [];
  if (data.AbstractText) parts.push(data.AbstractText);
  if (data.Answer) parts.push(`Answer: ${data.Answer}`);
  if (data.Definition) parts.push(`Definition: ${data.Definition}`);
  const related = (data.RelatedTopics ?? [])
    .slice(0, 4)
    .map((t: any) => t.Text)
    .filter(Boolean);
  if (related.length) parts.push("Related:\n" + related.join("\n"));
  return parts.join("\n\n");
}

export const searchWeb = tool({
  description:
    "Search the web for real-time information. Automatically uses Google News for news/current events queries and DuckDuckGo for factual queries. " +
    "Use this for: latest news, current events, recent developments, facts about people/places/things.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
    type: z
      .enum(["news", "facts", "auto"])
      .optional()
      .describe("Search type: 'news' for current events, 'facts' for encyclopedic info, 'auto' to decide (default)"),
  }),
  execute: async ({ query, type = "auto" }) => {
    // Determine search type
    const newsKeywords = /新闻|news|今天|今日|最新|热门|热搜|事件|发生|最近|current|latest|today|breaking|report/i;
    const isNews = type === "news" || (type === "auto" && newsKeywords.test(query));

    if (isNews) {
      try {
        const articles = await searchGoogleNews(query);
        if (articles.length > 0) {
          const formatted = articles
            .map((a, i) => `${i + 1}. **${a.title}**\n   来源: ${a.source}  时间: ${a.date}`)
            .join("\n\n");
          return {
            query,
            type: "news",
            count: articles.length,
            results: formatted,
          };
        }
      } catch {}

      // Fallback: try English query on Google News
      try {
        const articles = await searchGoogleNews(query, "en");
        if (articles.length > 0) {
          const formatted = articles
            .map((a, i) => `${i + 1}. **${a.title}**\n   Source: ${a.source}  Date: ${a.date}`)
            .join("\n\n");
          return { query, type: "news", count: articles.length, results: formatted };
        }
      } catch {}

      return { query, type: "news", results: "No news found. Try a more specific query or use fetchUrl with a news site URL." };
    }

    // Factual search via DuckDuckGo
    try {
      const result = await searchDDG(query);
      if (result) return { query, type: "facts", results: result };
    } catch {}

    return { query, results: "No results found." };
  },
});
