import { tool } from "ai";
import { z } from "zod";

export const getWikipedia = tool({
  description:
    "Get a summary of a topic from Wikipedia. Useful for factual questions about people, places, events, concepts, or any encyclopedic knowledge.",
  inputSchema: z.object({
    topic: z.string().describe("The topic to look up on Wikipedia"),
    language: z
      .string()
      .optional()
      .describe("Language code, e.g. 'en', 'zh', 'ja' (default: 'en')"),
  }),
  execute: async ({ topic, language = "en" }) => {
    try {
      const searchUrl = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`;
      const res = await fetch(searchUrl, {
        headers: { "User-Agent": "chatbot/1.0" },
      });

      if (!res.ok) {
        // Try search API to find the right title
        const searchRes = await fetch(
          `https://${language}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&srlimit=1`,
          { headers: { "User-Agent": "chatbot/1.0" } }
        );
        const searchData = await searchRes.json() as any;
        const firstResult = searchData?.query?.search?.[0];
        if (!firstResult) {
          return { topic, error: `No Wikipedia article found for "${topic}".` };
        }

        const summaryRes = await fetch(
          `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstResult.title)}`,
          { headers: { "User-Agent": "chatbot/1.0" } }
        );
        const summary = await summaryRes.json() as any;
        return {
          title: summary.title,
          summary: summary.extract,
          url: summary.content_urls?.desktop?.page,
        };
      }

      const data = await res.json() as any;
      return {
        title: data.title,
        summary: data.extract,
        url: data.content_urls?.desktop?.page,
      };
    } catch (e) {
      return { topic, error: "Failed to fetch Wikipedia data." };
    }
  },
});
