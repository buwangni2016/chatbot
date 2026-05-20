import { tool } from "ai";
import { z } from "zod";

export const getCurrentTime = tool({
  description:
    "Get the current date and time for any timezone. Use this when asked about the current time, date, day of the week, or time in a specific city/region.",
  inputSchema: z.object({
    timezone: z
      .string()
      .optional()
      .describe(
        "IANA timezone name, e.g. 'Asia/Shanghai', 'America/New_York', 'Europe/London'. Defaults to UTC."
      ),
  }),
  execute: async ({ timezone = "UTC" }) => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        weekday: "long",
        hour12: false,
      });

      const parts = Object.fromEntries(
        formatter.formatToParts(now).map((p) => [p.type, p.value])
      );

      return {
        timezone,
        datetime: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`,
        weekday: parts.weekday,
        utcOffset: new Intl.DateTimeFormat("en", {
          timeZone: timezone,
          timeZoneName: "longOffset",
        })
          .formatToParts(now)
          .find((p) => p.type === "timeZoneName")?.value ?? "",
      };
    } catch (e) {
      return {
        error: `Invalid timezone: "${timezone}". Use IANA format like "Asia/Shanghai".`,
      };
    }
  },
});
