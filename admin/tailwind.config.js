/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        newspulse: {
          navy: 'rgb(var(--np-color-deep-navy-rgb) / <alpha-value>)',
          blue: 'rgb(var(--np-color-pulse-blue-rgb) / <alpha-value>)',
          red: 'rgb(var(--np-color-breaking-red-rgb) / <alpha-value>)',
          slate: 'rgb(var(--np-color-slate-gray-rgb) / <alpha-value>)',
          white: 'rgb(var(--np-color-white-rgb) / <alpha-value>)',
        },
      },
    },
  },
  darkMode: 'class',
  plugins: []
};
