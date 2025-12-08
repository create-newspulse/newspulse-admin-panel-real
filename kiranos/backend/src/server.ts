import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import { chatHandler } from "./router.chat.js";
import { commandHandler } from "./router.command.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));

const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174'];
const envOrigins = (process.env.ALLOWED_ORIGIN || process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const allowed = envOrigins.length ? envOrigins : DEV_ORIGINS;
app.use(cors({ origin: allowed, credentials: true }));

// Simple founder auth guard
app.use((req: Request, res: Response, next: NextFunction) => {
  const key = req.headers.authorization?.replace("Bearer ", "");
  if (!key || key !== process.env.FOUNDER_API_KEY) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
});

app.post("/api/kiranos/chat", chatHandler);
app.post("/api/kiranos/command", commandHandler);

app.get("/api/kiranos/health", (_: Request, res: Response) =>
  res.json({ ok: true, service: "KiranOS v5", uptime: process.uptime() })
);

const port = Number(process.env.PORT || 5050);
app.listen(port, () => console.log(`KiranOS backend listening on :${port}`));
