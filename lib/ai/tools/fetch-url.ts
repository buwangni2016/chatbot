import { tool } from "ai";
import { z } from "zod";

export const fetchUrl = tool({
  description:
    "Fetch and read the content of a web page URL. Useful for reading articles, documentation, or any public webpage the user shares.",
  inputSchema: z.object({
    url: z.string().url().describe("The full URL to fetch"),
    maxLength: z
      .number()
      .optional()
      .describe("Max characters to return (default 3000)"),
  }),
  execute: async ({ url, maxLength = 3000 }) => {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; chatbot/1.0)",
          Accept: "text/html,text/plain,*/*",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        return { url, error: `HTTP ${res.status}: ${res.statusText}` };
      }

      const contentType = res.headers.get("content-type") ?? "";
      const text = await res.text();

      // Strip HTML tags to get readable text
      const stripped = text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();

      const content = stripped.slice(0, maxLength);
      const truncated = stripped.length > maxLength;

      return {
        url,
        contentType,
        content,
        truncated,
        totalLength: stripped.length,
      };
    } catch (e: any) {
      return { url, error: e.message ?? "Failed to fetch URL." };
    }
  },
});
