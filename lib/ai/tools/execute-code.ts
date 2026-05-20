import { tool } from "ai";
import { z } from "zod";
import { Sandbox } from "@vercel/sandbox";

const PROJECT_ID = process.env.VERCEL_PROJECT_ID!;
const TEAM_ID    = process.env.VERCEL_TEAM_ID ?? process.env.VERCEL_ORG_ID;
const TOKEN      = process.env.VERCEL_TOKEN;

export const executeCode = tool({
  description:
    "Execute code in an isolated Vercel Sandbox environment and return the output. " +
    "Supports Python 3 and Node.js. Use this for data processing, calculations, " +
    "file generation, web scraping, or any task that requires real computation. " +
    "The sandbox has internet access and common packages available.",
  inputSchema: z.object({
    language: z
      .enum(["python", "node"])
      .describe("Programming language: 'python' or 'node'"),
    code: z.string().describe("The code to execute"),
    packages: z
      .array(z.string())
      .optional()
      .describe("Additional packages to install before running (e.g. ['requests', 'pandas'])"),
  }),
  execute: async ({ language, code, packages = [] }) => {
    let sandbox: Sandbox | null = null;
    try {
      // Create sandbox - VERCEL_OIDC_TOKEN is auto-injected in Vercel functions
      const sandboxOptions: Parameters<typeof Sandbox.create>[0] = {
        runtime: language === "python" ? "node22" : "node22",
        resources: { vcpus: 1 },
        timeout: 60_000, // 1 minute
        ...(TOKEN && TEAM_ID && PROJECT_ID
          ? { token: TOKEN, teamId: TEAM_ID, projectId: PROJECT_ID }
          : {}),
      };

      sandbox = await Sandbox.create(sandboxOptions);

      // Write the code to a file
      const filename = language === "python" ? "/tmp/code.py" : "/tmp/code.js";
      const writeResult = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", `cat > ${filename} << 'CODEOF'\n${code}\nCODEOF`],
      });

      if (writeResult.exitCode !== 0) {
        return { error: "Failed to write code to sandbox." };
      }

      // Install packages if requested
      if (packages.length > 0) {
        const pkgCmd =
          language === "python"
            ? { cmd: "pip", args: ["install", "--quiet", ...packages] }
            : { cmd: "npm", args: ["install", "--prefix", "/tmp", ...packages] };

        const pkgResult = await sandbox.runCommand(pkgCmd);
        if (pkgResult.exitCode !== 0) {
          return {
            error: `Package installation failed: ${pkgResult.stderr?.slice(0, 200)}`,
          };
        }
      }

      // Run the code
      const stdout: string[] = [];
      const stderr: string[] = [];

      const runResult = await sandbox.runCommand(
        language === "python"
          ? { cmd: "python3", args: [filename] }
          : { cmd: "node", args: [filename] },
        {
          stdout: { write: (chunk: string) => { stdout.push(chunk); } },
          stderr: { write: (chunk: string) => { stderr.push(chunk); } },
        } as any
      );

      const output = stdout.join("").trim();
      const errOutput = stderr.join("").trim();

      return {
        language,
        exitCode: runResult.exitCode,
        output: output.slice(0, 4000) || "(no output)",
        error: errOutput.slice(0, 1000) || undefined,
        truncated: output.length > 4000,
      };
    } catch (e: any) {
      return { error: `Sandbox error: ${e.message ?? String(e)}` };
    } finally {
      if (sandbox) {
        try { await sandbox.destroy(); } catch {}
      }
    }
  },
});
