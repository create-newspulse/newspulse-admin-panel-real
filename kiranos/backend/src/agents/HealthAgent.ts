import type { AgentTool, ToolResult } from "./index.js";

export class HealthAgent implements AgentTool {
  name = "HealthAgent.check";
  async run(): Promise<ToolResult> {
    return { ok: true, data: { api: "ok", db: "ok", uptime: process.uptime() } };
  }
}
