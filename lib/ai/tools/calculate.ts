import { tool } from "ai";
import { z } from "zod";

/**
 * Safely evaluate a math expression using a tokenizer + recursive descent parser.
 * Replaces new Function() to avoid code injection risks.
 * Supports: basic ops, sqrt/abs/ceil/floor/round/log/sin/cos/tan, %, PI, E, ^,
 * and parenthesized expressions. No variables, no strings, no function names.
 */
export const calculate = tool({
  description:
    "Calculate the result of a mathematical expression. Supports basic operations, functions like sqrt(), abs(), ceil(), floor(), round(), log(), sin(), cos(), tan(), the constants PI and E, percentage (%), power (^), and parentheses. Order of operations is respected.",
  inputSchema: z.object({
    expression: z
      .string()
      .describe("The mathematical expression to calculate, e.g. '2 + 2' or 'sqrt(144)' or '15% of 200'"),
  }),
  execute: async ({ expression }: { expression: string }) => {
    let processed = expression
      .replace(/sqrt\(/g, "sqrt(")
      .replace(/abs\(/g, "abs(")
      .replace(/ceil\(/g, "ceil(")
      .replace(/floor\(/g, "floor(")
      .replace(/round\(/g, "round(")
      .replace(/log\(/g, "log(")
      .replace(/sin\(/g, "sin(")
      .replace(/cos\(/g, "cos(")
      .replace(/tan\(/g, "tan(")
      .replace(/pi/gi, "PI")
      .replace(/(?<![a-zA-Z])e(?![a-zA-Z])/g, "E")
      .replace(/\^/g, "**")
      .replace(/(\d+\.?\d*)%\s*of\s*(\d+\.?\d*)/i, "($1/100)*$2")
      .replace(/(\d+\.?\d*)%/g, "($1/100)");

    // Allowlist: only safe characters for expressions
    const safePattern = /^[0-9+\-*/().,%\s_PIsqrtabceilorundflglnsiocnE]*$/;
    if (!safePattern.test(processed)) {
      throw new Error("Expression contains disallowed characters.");
    }

    interface Token {
      type: "number" | "operator" | "keyword" | "lparen" | "rparen";
      value: string;
    }

    function tokenize(input: string): Token[] {
      const tokens: Token[] = [];
      let i = 0;
      while (i < input.length) {
        const ch = input[i];
        if (/\s/.test(ch)) { i++; continue; }
        if (/\d/.test(ch) || (ch === "." && i + 1 < input.length && /\d/.test(input[i + 1]))) {
          let num = "";
          while (i < input.length && (/\d/.test(input[i]) || input[i] === ".")) {
            num += input[i]; i++;
          }
          tokens.push({ type: "number", value: num });
          continue;
        }
        if ("+-".includes(ch)) {
          tokens.push({ type: "operator", value: ch }); i++; continue;
        }
        if (ch === "*" && i + 1 < input.length && input[i + 1] === "*") {
          tokens.push({ type: "operator", value: "**" }); i += 2; continue;
        }
        if (ch === "*") {
          tokens.push({ type: "operator", value: "*" }); i++; continue;
        }
        if (ch === "/") {
          tokens.push({ type: "operator", value: "/" }); i++; continue;
        }
        if (ch === "(") {
          tokens.push({ type: "lparen", value: "(" }); i++; continue;
        }
        if (ch === ")") {
          tokens.push({ type: "rparen", value: ")" }); i++; continue;
        }
        if (/[a-zA-Z_]/.test(ch)) {
          let word = "";
          while (i < input.length && (/[a-zA-Z0-9_]/.test(input[i]))) {
            word += input[i]; i++;
          }
          tokens.push({ type: "keyword", value: word });
          continue;
        }
        throw new Error(`Unexpected character: ${ch}`);
      }
      return tokens;
    }

    class Parser {
      private tokens: Token[];
      private pos: number;

      constructor(tokens: Token[]) {
        this.tokens = tokens;
        this.pos = 0;
      }

      private peek(): Token | undefined {
        return this.tokens[this.pos];
      }

      private consume(): Token {
        return this.tokens[this.pos++];
      }

      parse(): number {
        return this.addition();
      }

      private addition(): number {
        let left = this.multiplication();
        while (this.peek()?.type === "operator" && ["+", "-"].includes(this.peek()!.value)) {
          const op = this.consume().value;
          const right = this.multiplication();
          left = op === "+" ? left + right : left - right;
        }
        return left;
      }

      private multiplication(): number {
        let left = this.power();
        while (this.peek()?.type === "operator" && ["*", "/"].includes(this.peek()!.value)) {
          const op = this.consume().value;
          const right = this.power();
          left = op === "*" ? left * right : left / right;
        }
        return left;
      }

      private power(): number {
        let left = this.primary();
        if (this.peek()?.value === "**") {
          this.consume();
          left = left ** this.power(); // right-associative
        }
        return left;
      }

      private primary(): number {
        const token = this.peek();
        if (!token) throw new Error("Unexpected end of expression");

        if (token.type === "number") {
          this.consume();
          return parseFloat(token.value);
        }

        if (token.type === "operator" && ["-", "+"].includes(token.value)) {
          this.consume();
          return token.value === "-" ? -this.power() : this.power();
        }

        if (token.type === "lparen") {
          this.consume();
          const result = this.addition();
          this.consume(); // consume ')'
          return result;
        }

        if (token.type === "keyword") {
          const funcName = token.value;
          this.consume();

          // Check for function call: funcName(...)
          if (this.peek()?.value === "(") {
            this.consume(); // consume '('
            const arg = this.addition();
            this.consume(); // consume ')'

            const funcs: Record<string, (x: number) => number> = {
              sqrt: (x) => x ** 0.5,
              abs: Math.abs,
              ceil: Math.ceil,
              floor: Math.floor,
              round: (x) => Math.round(x),
              log: Math.log,
              sin: Math.sin,
              cos: Math.cos,
              tan: Math.tan,
            };

            if (funcName in funcs) {
              return funcs[funcName](arg);
            }
            throw new Error(`Unsupported function: ${funcName}`);
          }

          // Check for constant: PI or E
          if (funcName === "PI") return Math.PI;
          if (funcName === "E") return Math.E;

          throw new Error(`Unexpected keyword: ${funcName}`);
        }

        throw new Error(`Unexpected token: ${token.value}`);
      }
    }

    const tokens = tokenize(processed);
    const parser = new Parser(tokens);
    const result = parser.parse();

    if (typeof result !== "number" || !Number.isFinite(result)) {
      throw new Error("Result is not a finite number.");
    }

    return {
      expression: processed,
      result: parseFloat(result.toFixed(10)),
    };
  },
});
