const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Connect to MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/news-pulse", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ Admin Schema
const Admin = mongoose.model("Admin", new mongoose.Schema({
  email: String,
  password: String,
}));

// ✅ Login Route
app.post("/api/admin/login", async (req, res) => {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email, password });

  if (admin) {
    res.json({ success: true, token: "real-admin-token" });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

// ✅ Test Route
app.get("/", (req, res) => {
  res.send("✅ Real Admin API running");
});

app.listen(5000, () => {
  console.log("🚀 Admin API is running at http://localhost:5000");
});
