import { tool } from "ai";
import { z } from "zod";

export const searchWeb = tool({
  description:
    "Search the web for real-time information using DuckDuckGo. Use this for current events, news, facts, or anything requiring up-to-date information.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
  }),
  execute: async ({ query }) => {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const res = await fetch(url, {
        headers: { "User-Agent": "chatbot/1.0" },
      });
      const data = await res.json() as any;

      const parts: string[] = [];

      if (data.AbstractText) parts.push(data.AbstractText);
      if (data.Answer) parts.push(`Answer: ${data.Answer}`);
      if (data.Definition) parts.push(`Definition: ${data.Definition}`);

      const related = (data.RelatedTopics ?? [])
        .slice(0, 5)
        .map((t: any) => t.Text)
        .filter(Boolean);
      if (related.length) parts.push("Related:\n" + related.join("\n"));

      if (parts.length === 0) {
        return { query, results: "No results found. Try a different query." };
      }

      return { query, results: parts.join("\n\n") };
    } catch (e) {
      return { query, error: "Search failed. Please try again." };
    }
  },
});
