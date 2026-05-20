/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#AFD5AA',
          'green-dark': '#3C6D36',
          light: '#F0F2EF',
          dark:  '#5C5346',
          mid:   '#A69F98',
          clay:  '#8C6057',
        },
      },
    },
  },
  plugins: [],
};
