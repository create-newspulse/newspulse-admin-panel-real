import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/**/*.{ts,tsx}',
    '../src/**/*.{ts,tsx}', // allow reuse of shared styles
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          600: '#2563eb',
          700: '#1d4ed8',
        }
      }
    },
  },
  plugins: [],
} satisfies Config;