import axios from "axios";
// Toast is safe to import here because <Toaster/> is mounted in NotificationProvider at app root
import { toast } from 'react-hot-toast';

const baseURL =
	(import.meta.env.VITE_ADMIN_API_BASE as string | undefined) ||
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
				// Handle admin auth expiry on 401 for /admin/* endpoints
				if (
					status === 401 &&
					reqUrl && /\/admin\//.test(reqUrl) &&
					typeof window !== 'undefined' &&
					!authRedirectTriggered &&
					window.location.pathname !== '/login'
				) {
					try {
						// Clear known admin auth token storage keys
						localStorage.removeItem('newsPulseAdminAuth');
						localStorage.removeItem('np_admin_access_token');
						localStorage.removeItem('np_admin_token');
					} catch {}
					// Mark so we don't spam redirects if many requests fail together
					authRedirectTriggered = true;
					// User feedback – toast if available, fallback to console
					try {
						toast.error('[Auth] Session expired – please log in again.');
					} catch {
						console.log('[Auth] Session expired – please log in again.');
					}
					// Redirect to login
					try {
						window.location.assign('/login');
					} catch {}
				}
			} catch {}
			return Promise.reject(error);
		}
	);
}

export default adminApi;
