import axios from "axios";

const api = axios.create({
  baseURL: "https://jsonplaceholder.typicode.com", // ✅ Test-safe endpoint
});

export default api;
