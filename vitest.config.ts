import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Align Vitest path aliases with Vite so tests can import using @/*
export default defineConfig({
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
			'@components': fileURLToPath(new URL('./src/components', import.meta.url)),
			'@pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
			'@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
			'@context': fileURLToPath(new URL('./src/context', import.meta.url)),
			'@hooks': fileURLToPath(new URL('./src/hooks', import.meta.url)),
			'@assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
			'@styles': fileURLToPath(new URL('./src/styles', import.meta.url)),
			'@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
			'@config': fileURLToPath(new URL('./src/config', import.meta.url)),
			'@types': fileURLToPath(new URL('./src/types', import.meta.url)),
			'@features': fileURLToPath(new URL('./src/features', import.meta.url)),
		},
	},
	test: {
		environment: 'jsdom',
		globals: true,
		reporters: 'default',
	},
});

