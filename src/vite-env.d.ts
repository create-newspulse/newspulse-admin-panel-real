/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_API_ORIGIN?: string;
  readonly VITE_ADMIN_API_ORIGIN?: string;
  readonly VITE_ADMIN_API_URL?: string;
  readonly VITE_ADMIN_API_BASE_URL?: string;
  readonly VITE_ADMIN_API_PROXY_BASE?: string;
  readonly VITE_USE_PROXY?: string;
  readonly VITE_OPENAI_API_KEY?: string;
  // Add more env variables here as needed
}
