/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#3B82F6',
          dark: '#60A5FA',
        },
        background: {
          light: '#FFFFFF',
          dark: '#1F2937',
        },
        surface: {
          light: '#F9FAFB',
          dark: '#374151',
        },
        text: {
          light: '#111827',
          dark: '#F9FAFB',
        },
      },
    },
  },
  plugins: [],
};
