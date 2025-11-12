require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const ORIGINS = (process.env.CORS_ORIGINS||"").split(",").filter(Boolean);
app.use(cors({ origin: (o,cb)=>(!o||ORIGINS.includes(o))?cb(null,true):cb(null,false), credentials:true }));
app.use(express.json({ limit: "1mb" }));

mongoose.connect(process.env.MONGODB_URI,{ dbName: process.env.MONGO_DB||"newspulse" })
  .then(()=>console.log("Mongo connected"))
  .catch(e=>console.error("Mongo error",e));

app.get("/health",(_req,res)=>res.send("ok"));
app.use("/api/live-content", require("./routes/liveContent"));

const io = new Server(server,{ cors:{ origin: ORIGINS, methods:["GET","POST"] }});
app.set("io", io);
io.on("connection", s=>console.log("socket", s.id));

server.listen(process.env.PORT||5000, ()=>console.log("API up"));
