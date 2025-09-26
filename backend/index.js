// backend/index.js (Local Mode)

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Fake Login Route
app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (email === "admin@example.com" && password === "12345") {
    return res.json({
      success: true,
      token: "local-admin-token"
    });
  } else {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials"
    });
  }
});

// ✅ Optional: Test Route
app.get("/", (req, res) => {
  res.send("🧪 Local Fake Admin API is running");
});

app.listen(5000, () => {
  console.log("🔐 Local Admin API running at http://localhost:5000");
});
