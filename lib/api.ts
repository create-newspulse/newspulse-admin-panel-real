import axios from "axios";

const api = axios.create({
  baseURL: "https://newspulse-backend.onrender.com/api", // ⬅️ your working backend
});

export default api;
