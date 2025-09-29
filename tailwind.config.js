const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx,css,html}'],
  theme: {
    extend: {
      colors: {
        primary: '#4f46e5', // indigo-600
        'primary-focus': '#4338ca', // indigo-700
        secondary: '#6b7280', // gray-500
        'secondary-focus': '#4b5563', // gray-600
        accent: '#ec4899', // pink-500

        'base-100': '#ffffff', // white
        'base-200': '#f3f4f6', // gray-100
        'base-300': '#e5e7eb', // gray-200
        'base-content': '#1f2937', // gray-800

        info: '#3abff8',
        success: '#36d399',
        warning: '#fbbd23',
        error: '#f87272',

        // Retro Apple Rainbow
        'rainbow-green': '#34a853',
        'rainbow-yellow': '#fbbc05',
        'rainbow-orange': '#ea4335',
        'rainbow-red': '#e11d48',
        'rainbow-purple': '#8b5cf6',
        'rainbow-blue': '#4285f4',
      },
      gradientColorStops: {
        primary: '#4f46e5',
        success: '#36d399',
        secondary: '#6b7280',
        accent: '#ec4899',
        'rainbow-green': '#34a853',
        'rainbow-yellow': '#fbbc05',
        'rainbow-orange': '#ea4335',
        'rainbow-red': '#e11d48',
        'rainbow-purple': '#8b5cf6',
        'rainbow-blue': '#4285f4',
      },
      fontFamily: {
        sans: ['Crimson Text', ...defaultTheme.fontFamily.sans],
      },
      borderRadius: {
        ...defaultTheme.borderRadius,
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
    },
  },
  plugins: [],
};
