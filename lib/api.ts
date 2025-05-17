// lib/api.ts
import axios from "axios";

const api = axios.create({
  baseURL: "https://your-backend-url.com/api", // Replace this with your working backend URL
});

export default api;
