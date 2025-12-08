export type ToolCall = { tool: string; args?: Record<string, any> };
export type ToolResult = { ok: boolean; data?: any; error?: string };

export interface AgentTool {
  name: string;
  run(args?: Record<string, any>): Promise<ToolResult>;
}

import { DeployAgent } from "./DeployAgent.js";
import { HealthAgent } from "./HealthAgent.js";

const registry: Record<string, AgentTool> = {
  "DeployAgent.deploy": new DeployAgent(),
  "HealthAgent.check": new HealthAgent(),
};

export async function runTool(tc: ToolCall): Promise<ToolResult> {
  const tool = registry[tc.tool];
  if (!tool) return { ok: false, error: `Unknown tool: ${tc.tool}` };
  return tool.run(tc.args);
}
