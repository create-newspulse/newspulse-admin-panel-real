// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  // The 'content' array specifies all the files that Tailwind CSS should scan
  // to detect where your utility classes are being used. This is crucial for
  // Tailwind's JIT (Just-In-Time) engine to generate only the CSS you need,
  // resulting in the smallest possible production CSS bundle.
  content: [
    './index.html', // Main HTML file, typically where your React app mounts
    './src/**/*.{js,ts,jsx,tsx}', // Catches all JS, TS, JSX, TSX files within the src directory
    // Adding more specific common paths for absolute clarity, though './src/**/*.{...}' often covers them:
    './src/pages/**/*.{(js|ts|jsx|tsx)}',        // Common for page-level components
    './src/components/**/*.{(js|ts|jsx|tsx)}',    // Common for reusable UI components
    './src/layouts/**/*.{(js|ts|jsx|tsx)}',       // Common for layout wrappers
    './src/App.tsx',                              // Explicitly include the main App component
    // If you have shared utility files that define styles (e.g., constants.js with class names):
    // './src/utils/**/*.{(js|ts)}',
    // If you use Tailwind classes directly in your public HTML files (e.g., for static pages):
    // './public/**/*.html',
  ],

  // 'darkMode' configuration:
  // - 'media' (default): Uses the user's operating system preference (prefers-color-scheme).
  // - 'class': Allows manual toggling of dark mode by adding/removing a 'dark' class
  //            on a parent element (e.g., the <html> tag). This is recommended
  //            when you want to provide a user-facing theme switcher.
  darkMode: 'class',

  theme: {
    // 'extend' allows you to add custom configurations to Tailwind's default theme
    // without entirely overwriting existing values.
    extend: {
      // Customizing fonts:
      fontFamily: {
        // Defines a 'sans' font stack. 'Inter' will be used if available,
        // falling back to system defaults. Ensure 'Inter' is imported/linked
        // in your global CSS or HTML.
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Example: Add a custom display font
        // display: ['Oswald', 'sans-serif'],
      },
      // Customizing colors:
      colors: {
        // Define your primary brand colors with shades
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Define secondary colors or other semantic colors
        secondary: '#6c757d',
        accent: '#f59e0b', // Example accent color
        // Add more application-specific colors as needed
      },
      // Customizing keyframes for animations:
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      // Mapping keyframes to animation utility classes:
      animation: {
        fadeIn: 'fadeIn 0.5s ease-out forwards',
        slideInRight: 'slideInRight 0.4s ease-out forwards',
      },
      // Example: Customizing spacing (e.g., adding more fine-grained values)
      // spacing: {
      //   '128': '32rem',
      //   '144': '36rem',
      // },
    },
  },

  // 'plugins' enable additional features and utility classes for Tailwind CSS.
  // Make sure these packages are installed via npm or yarn (e.g., `npm install @tailwindcss/forms`).
  plugins: [
    // @tailwindcss/forms: Provides a basic reset for form element styles, making them
    // more consistent across browsers and easier to style with Tailwind utilities.
    require('@tailwindcss/forms'),
    // @tailwindcss/typography: Adds `prose` classes for beautiful typographic defaults,
    // ideal for displaying rich, long-form content (like blog posts, articles, etc.).
    require('@tailwindcss/typography'),
    // @tailwindcss/aspect-ratio: Adds `aspect-ratio` utility classes, simplifying
    // the creation of elements with fixed aspect ratios (e.g., for embedded videos, images).
    require('@tailwindcss/aspect-ratio'),
    // Optional additional plugins you might find useful:
    // require('@tailwindcss/line-clamp'), // For truncating text after a certain number of lines
    // require('@tailwindcss/container-queries'), // For element-scoped media queries
  ],
};