import { defineConfig } from 'vitest/config';

// Minimal Vitest config to avoid startup error when running `npm test`
export default defineConfig({
	test: {
		environment: 'jsdom',
		globals: true,
		reporters: 'default',
	},
});

