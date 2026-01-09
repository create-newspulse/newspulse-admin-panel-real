import { setAuthToken } from "./api";


export function bootstrapAuth() {
  const t = localStorage.getItem("admin_token");
  if (t) setAuthToken(t);
}
