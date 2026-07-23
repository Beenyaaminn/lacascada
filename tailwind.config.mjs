/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F0F7F7',
          100: '#DCEBEB',
          200: '#B9D7D8',
          300: '#8FBDBF',
          400: '#5C9AA0',
          500: '#3B7B84',
          600: '#205C66',
          700: '#1B4E56',
          800: '#164046',
          900: '#102F34',
        },
      },
    },
  },
  plugins: [],
};
