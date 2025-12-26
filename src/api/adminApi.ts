// Back-compat module: older code imports from '@/api/adminApi'.
// The unified client lives in src/lib/api.ts and is built from VITE_API_URL.
import { adminApi } from '@/lib/api';

export { adminApi };
export default adminApi;
