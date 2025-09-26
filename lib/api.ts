import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api", // ✅ this is key
});

export default api;
