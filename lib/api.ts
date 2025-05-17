import axios from "axios";

const api = axios.create({
  baseURL: "https://your-backend-url.com/api", // 🔁 Replace with real backend URL
});

export default api;
