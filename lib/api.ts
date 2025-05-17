import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000", // ✅ Must match your Express server port
});

export default api;
