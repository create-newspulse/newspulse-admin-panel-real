// index.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🛡️ Admin Login Route
app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (email === "admin@example.com" && password === "12345") {
    return res.json({
      success: true,
      token: "news-pulse-demo-token",
    });
  } else {
    return res.json({
      success: false,
      message: "Invalid credentials",
    });
  }
});

// ✅ Confirm server is running
app.listen(5000, () => {
  console.log("🔐 Admin API is running at http://localhost:5000");
});
