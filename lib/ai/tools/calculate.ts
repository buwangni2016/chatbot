import { tool } from "ai";
import { z } from "zod";

export const calculate = tool({
  description:
    "Evaluate a mathematical expression and return the result. Supports arithmetic, percentages, powers, and common math functions. Use this for any calculation instead of computing in your head.",
  inputSchema: z.object({
    expression: z
      .string()
      .describe(
        "Math expression to evaluate, e.g. '2 + 2', '15% of 200', 'sqrt(144)', '2^10', '(100 - 20) * 1.13'"
      ),
  }),
  execute: async ({ expression }) => {
    try {
      // Normalize common patterns before evaluation
      let expr = expression
        .replace(/(\d+\.?\d*)%\s*of\s*(\d+\.?\d*)/i, "($1/100)*$2")
        .replace(/(\d+\.?\d*)%/g, "($1/100)")
        .replace(/\^/g, "**")
        .replace(/sqrt\(/g, "Math.sqrt(")
        .replace(/abs\(/g, "Math.abs(")
        .replace(/ceil\(/g, "Math.ceil(")
        .replace(/floor\(/g, "Math.floor(")
        .replace(/round\(/g, "Math.round(")
        .replace(/log\(/g, "Math.log(")
        .replace(/sin\(/g, "Math.sin(")
        .replace(/cos\(/g, "Math.cos(")
        .replace(/tan\(/g, "Math.tan(")
        .replace(/pi/gi, "Math.PI")
        .replace(/e(?![a-zA-Z])/g, "Math.E");

      // Only allow safe characters
      if (!/^[0-9+\-*/().,%\s_MathPIEsqrabceilorundflg]+$/.test(expr)) {
        return { expression, error: "Unsupported characters in expression." };
      }

      // eslint-disable-next-line no-new-func
      const result = new Function(`"use strict"; return (${expr})`)();

      if (typeof result !== "number" || !isFinite(result)) {
        return { expression, error: "Result is not a finite number." };
      }

      return {
        expression,
        result: Math.round(result * 1e10) / 1e10,
      };
    } catch (e) {
      return { expression, error: "Invalid expression." };
    }
  },
});
