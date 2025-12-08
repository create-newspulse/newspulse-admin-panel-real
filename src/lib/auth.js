import { setAuthToken } from "./api";
export function bootstrapAuth() {
    const t = localStorage.getItem("np_token");
    if (t)
        setAuthToken(t);
}
