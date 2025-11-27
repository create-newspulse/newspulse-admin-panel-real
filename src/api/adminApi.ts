import axios from "axios";

const baseURL =
	(import.meta.env.VITE_ADMIN_API_BASE as string | undefined) ||
	"https://newspulse-backend-real.onrender.com";

export const adminApi = axios.create({
	baseURL,
	withCredentials: true,
});

let interceptorsAttached = false;
if (!interceptorsAttached) {
	interceptorsAttached = true;

	adminApi.interceptors.request.use((config) => {
		try {
			let token: string | null = null;
			try {
				const raw = typeof window !== "undefined" ? localStorage.getItem("newsPulseAdminAuth") : null;
				if (raw) {
					try {
						const parsed = JSON.parse(raw);
						if (parsed?.accessToken) token = String(parsed.accessToken);
						else if (parsed?.token) token = String(parsed.token);
					} catch {}
				}
			} catch {}
			if (!token && typeof window !== "undefined") {
				token = localStorage.getItem("np_admin_access_token") || localStorage.getItem("np_admin_token");
			}
			if (token) {
				if (!config.headers) {
					config.headers = {} as any; // initialize headers object for axios typing
				}
				(config.headers as any).Authorization = `Bearer ${token}`;
			}
		} catch {}
		return config;
	});

	adminApi.interceptors.response.use(
		(res) => res,
		(error) => {
			try {
				console.error(
					"[adminApi:err]",
					error?.response?.status,
					error?.config?.url,
					error?.response?.headers?.["content-type"] || ""
				);
			} catch {}
			return Promise.reject(error);
		}
	);
}

export default adminApi;
