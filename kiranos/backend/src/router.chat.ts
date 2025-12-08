import type { Request, Response } from "express";
import { openai, SYSTEM_PROMPT, OPENAI_MODEL } from "./openai.js";

function sseHeaders(res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
}

export async function chatHandler(req: Request, res: Response) {
  sseHeaders(res);

  const { message, history } = (req.body || {}) as { message?: string; history?: any[] };
  const msgs = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(Array.isArray(history) ? history : []),
    { role: "user", content: message || "" },
  ];

  try {
    const stream = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: msgs as any,
      stream: true,
      temperature: 0.6,
    });

    for await (const chunk of stream) {
      const delta = (chunk as any).choices?.[0]?.delta?.content ?? "";
      if (delta) res.write(`data: ${JSON.stringify({ type: "token", delta })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ type: "error", message: err?.message || "Chat error" })}\n\n`);
    res.end();
  }
}
