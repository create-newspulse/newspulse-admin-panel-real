import type { AgentTool, ToolResult } from "./index.js";

export class DeployAgent implements AgentTool {
  name = "DeployAgent.deploy";
  async run(args?: Record<string, any>): Promise<ToolResult> {
    try {
      const target = args?.project ?? "frontend";
      const envKey = `VERCEL_HOOK_${String(target).toUpperCase()}`;
      const hook = process.env[envKey as keyof NodeJS.ProcessEnv] as string | undefined;
      if (!hook) return { ok: false, error: `No hook configured for ${target}` };

      // Node 18+ has global fetch
      const r = await fetch(hook, { method: "POST" });
      if (!r.ok) return { ok: false, error: `Hook failed: ${r.status}` };

      return { ok: true, data: { target, status: "triggered" } };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Deploy error" };
    }
  }
}
