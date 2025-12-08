import type { Request, Response } from "express";
import { runTool } from "./agents/index.js";

export async function commandHandler(req: Request, res: Response) {
  const { tool, args } = (req.body || {}) as { tool?: string; args?: Record<string, any> };
  if (!tool) return res.status(400).json({ ok: false, error: "Missing tool" });

  try {
    const result = await runTool({ tool, args });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "Command failed" });
  }
}
