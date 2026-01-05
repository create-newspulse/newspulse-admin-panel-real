// NOTE:
// This file exists only for compatibility with extensionless imports like:
//   import api from '@/lib/api.js'
// The unified client lives in api.ts and derives base URLs from VITE_API_URL.

export { default } from './api.ts';
export * from './api.ts';
