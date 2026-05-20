import { tool } from "ai";
import { z } from "zod";

export const convertCurrency = tool({
  description:
    "Convert an amount from one currency to another using real-time exchange rates. Supports all major world currencies.",
  inputSchema: z.object({
    amount: z.number().describe("The amount to convert"),
    from: z.string().describe("Source currency code, e.g. 'USD', 'CNY', 'EUR'"),
    to: z.string().describe("Target currency code, e.g. 'JPY', 'GBP', 'HKD'"),
  }),
  execute: async ({ amount, from, to }) => {
    try {
      const fromUpper = from.toUpperCase();
      const toUpper = to.toUpperCase();

      // frankfurter.app is a free, no-key-required ECB rates API
      const res = await fetch(
        `https://api.frankfurter.app/latest?from=${fromUpper}&to=${toUpper}`
      );

      if (!res.ok) {
        return { error: `Unsupported currency pair: ${fromUpper} → ${toUpper}` };
      }

      const data = await res.json() as any;
      const rate = data.rates?.[toUpper];

      if (!rate) {
        return { error: `Exchange rate not available for ${toUpper}.` };
      }

      const converted = amount * rate;
      return {
        from: fromUpper,
        to: toUpper,
        amount,
        rate,
        result: Math.round(converted * 10000) / 10000,
        date: data.date,
      };
    } catch (e) {
      return { error: "Failed to fetch exchange rates. Please try again." };
    }
  },
});
