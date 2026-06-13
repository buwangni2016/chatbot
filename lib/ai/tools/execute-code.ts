import { tool } from "ai";
import { z } from "zod";
import { Sandbox } from "@vercel/sandbox";

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID ?? process.env.VERCEL_ORG_ID;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;

// Check if sandbox is properly configured
const hasSandboxConfig = VERCEL_TOKEN && VERCEL_TEAM_ID && VERCEL_PROJECT_ID;

export const executeCode = tool({
  description:
    "Execute code in an isolated Vercel Sandbox and return the output. " +
    (hasSandboxConfig 
      ? "Supports Python 3 and Node.js. Use for data processing, calculations, " +
        "file generation, web scraping, or any real computation task. " +
        "The sandbox has internet access and common packages available."
      : "Code sandbox not configured (VERCEL_API_TOKEN, VERCEL_TEAM_ID, or VERCEL_PROJECT_ID missing). " +
        "This tool will return an error. Set these environment variables to enable sandbox execution."),
  inputSchema: z.object({
    language: z
      .enum(["python", "node"])
      .describe("Programming language: 'python' or 'node'"),
    code: z.string().describe("The code to execute"),
    packages: z
      .array(z.string())
      .optional()
      .describe("Extra packages to install first (e.g. ['requests', 'pandas'])"),
  }),
  execute: async ({ language, code, packages = [] }) => {
    if (!hasSandboxConfig) {
      return {
        error: "Code sandbox not configured. Set VERCEL_TOKEN, VERCEL_TEAM_ID, and VERCEL_PROJECT_ID environment variables to enable."
      };
    }

    let sandbox: Sandbox | null = null;
    try {
      sandbox = await Sandbox.create({
        runtime: "node22",
        resources: { vcpus: 1 },
        timeout: 60_000,
        token: VERCEL_TOKEN,
        teamId: VERCEL_TEAM_ID,
        projectId: VERCEL_PROJECT_ID,
      });

      // Install packages first
      if (packages.length > 0) {
        const pkgCmd =
          language === "python"
            ? { cmd: "pip" as const, args: ["install", "--quiet", ...packages] }
            : { cmd: "npm" as const, args: ["install", "--prefix", "/tmp", ...packages] };

        const pkgResult = await sandbox.runCommand(pkgCmd);
        if (pkgResult.exitCode !== 0) {
          const errText = await pkgResult.stderr();
          return { error: `Package install failed: ${errText.slice(0, 300)}` };
        }
      }

      // Write code file via heredoc
      const filename = language === "python" ? "/tmp/code.py" : "/tmp/code.js";
      const escapedCode = code.replace(/\\/g, "\\\\").replace(/'/g, "'\\''");
      await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", `printf '%s' '${escapedCode}' > ${filename}`],
      });

      // Run the code
      const runner =
        language === "python"
          ? { cmd: "python3" as const, args: [filename] }
          : { cmd: "node" as const, args: [filename] };

      const result = await sandbox.runCommand(runner);
      const stdout = await result.stdout();
      const stderr = await result.stderr();

      return {
        language,
        exitCode: result.exitCode,
        output: stdout.slice(0, 4000) || "(no output)",
        ...(stderr ? { error: stderr.slice(0, 1000) } : {}),
        truncated: stdout.length > 4000,
      };
    } catch (e: any) {
      return { error: `Sandbox error: ${e.message ?? String(e)}` };
    } finally {
      if (sandbox) {
        try { await sandbox.stop(); } catch {}
      }
    }
  },
});
