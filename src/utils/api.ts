// Back-compat: some components import this legacy module.
// It now re-exports the unified admin axios client built from VITE_API_URL.
import { adminApi } from '@/lib/api';

export default adminApi;
