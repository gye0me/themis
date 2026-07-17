/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    colors: {
      white: '#ffffff',
      black: '#000000',
      transparent: 'transparent',
      text: '#6b6375',
      'text-h': '#08060d',
      bg: '#fff',
      border: '#e5e4e7',
      'code-bg': '#f4f3ec',
      accent: '#aa3bff',
      'accent-bg': '#faf0ff',
      'accent-border': '#e9ceff',
    },
    fontFamily: {
      sans: "system-ui, 'Segoe UI', Roboto, sans-serif",
      heading: "system-ui, 'Segoe UI', Roboto, sans-serif",
      mono: "ui-monospace, Consolas, monospace",
    },
    boxShadow: {
      custom: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    },
    extend: {},
  },
  plugins: [],
}