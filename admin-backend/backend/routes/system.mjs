import express from "express";
const router = express.Router();

router.get("/system/ai-training-info", (req, res) => {
  try {
    res.json({
      ok: true,
      engines: ["gpt-5", "gemini-1.5-pro"],
      updated: new Date().toISOString(),
    });
  } catch (err) {
    console.error("AI INFO ERROR:", err);
    res.status(500).json({ ok: false, message: "AI info failed" });
  }
});

export default router;