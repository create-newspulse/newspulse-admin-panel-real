import axios from "axios";
// Toast is safe to import here because <Toaster/> is mounted in NotificationProvider at app root
import { toast } from 'react-hot-toast';

const baseURL =
	(import.meta.env.VITE_ADMIN_API_URL as string | undefined) ||
	"https://newspulse-backend-real.onrender.com";

export const adminApi = axios.create({
	baseURL,
	withCredentials: true,
});

let interceptorsAttached = false;
// Guard to prevent repeated redirect blasts on clustered 401 failures
let authRedirectTriggered = false;

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
				const status = error?.response?.status;
				const reqUrl: string | undefined = error?.config?.url;
				// Log all errors exactly as before for non-401 or even 401 (keep behavior)
				console.error(
					"[adminApi:err]",
					status,
					reqUrl,
					error?.response?.headers?.["content-type"] || ""
				);
				// Handle 401 only when backend signals token expiration/invalid
				if (status === 401) {
					const code = error?.response?.data?.code || error?.response?.data?.errorCode;
					const isTokenExpired = code === 'TOKEN_EXPIRED_OR_INVALID' || code === 'UNAUTHORIZED';
					if (
						isTokenExpired &&
						reqUrl && /\/admin\//.test(reqUrl) &&
					typeof window !== 'undefined' &&
					!authRedirectTriggered
					) {
						try {
							localStorage.removeItem('newsPulseAdminAuth');
							localStorage.removeItem('np_admin_access_token');
							localStorage.removeItem('np_admin_token');
							localStorage.removeItem('adminToken');
						} catch {}
						authRedirectTriggered = true;
						try { toast.error('[Auth] Session expired – please log in again.'); } catch {}
						try { window.dispatchEvent(new CustomEvent('np:logout')); } catch {}
					}
				} else if (status === 403) {
					// Do not force logout; surface toast and emit forbidden event so router can show Access Denied
					try { toast.error('You do not have permission to perform this action.'); } catch {}
					try { (error as any).isForbidden = true; } catch {}
					try { window.dispatchEvent(new CustomEvent('np:forbidden')); } catch {}
				}
			} catch {}
			return Promise.reject(error);
		}
	);
}

export default adminApi;
