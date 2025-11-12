const router = require("express").Router();
const LiveContent = require("../models/LiveContent");
const sanitize = require("../utils/sanitizeEmbed");

router.get("/", async (_req,res)=>{
  try { const d = await LiveContent.getSingleton(); res.json({mode:d.mode, embedCode:d.embedCode, updatedAt:d.updatedAt}); }
  catch { res.status(500).json({error:"fetch failed"}); }
});

router.post("/update", async (req,res)=>{
  try{
    const { mode, embedCode } = req.body||{};
    if(!["inspiration","live"].includes(mode)) return res.status(400).json({error:"bad mode"});
    const d = await LiveContent.getSingleton();
    d.mode = mode; d.embedCode = sanitize(embedCode||""); await d.save();
    req.app.get("io")?.emit("live-content-updated",{mode:d.mode, embedCode:d.embedCode, updatedAt:d.updatedAt});
    res.json({ ok:true, mode:d.mode, embedCode:d.embedCode, updatedAt:d.updatedAt });
  }catch{ res.status(500).json({error:"update failed"}); }
});

module.exports = router;
