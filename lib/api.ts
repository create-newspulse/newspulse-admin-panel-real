import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api", // ✅ Must point to correct backend
});

export default api;
