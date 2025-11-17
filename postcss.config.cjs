// postcss.config.cjs
// Use the official PostCSS adapter for Tailwind when available
// (some Tailwind versions moved the PostCSS adapter to '@tailwindcss/postcss')
const tailwindPostcss = (() => {
  try {
    return require('@tailwindcss/postcss');
  } catch (e) {
    return require('tailwindcss');
  }
})();

module.exports = {
  plugins: {
    [tailwindPostcss.postcssPlugin || 'tailwindcss']: tailwindPostcss === require('tailwindcss') ? {} : {},
    autoprefixer: {},
  },
};
