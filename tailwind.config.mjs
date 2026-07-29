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
        admin: {
          bg: '#0c1222',
          surface: '#131c31',
          'surface-2': '#1a2540',
          'surface-3': '#223052',
          border: 'rgba(148, 163, 184, 0.08)',
          'border-hover': 'rgba(148, 163, 184, 0.15)',
          gold: '#d4a843',
          'gold-hover': '#e0b95a',
          'gold-dim': 'rgba(212, 168, 67, 0.1)',
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'Times New Roman', 'serif'],
        body: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'input-focus': 'input-focus 0.3s ease forwards',
        'card-hover': 'card-hover 0.3s ease forwards',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(212, 168, 67, 0.1)' },
          '100%': { boxShadow: '0 0 40px rgba(212, 168, 67, 0.2)' },
        },
        'input-focus': {
          '0%': { borderColor: 'rgba(148, 163, 184, 0.1)', boxShadow: '0 0 0 0px rgba(212, 168, 67, 0)' },
          '100%': { borderColor: 'rgba(212, 168, 67, 0.5)', boxShadow: '0 0 0 3px rgba(212, 168, 67, 0.1)' },
        },
        'card-hover': {
          '0%': { transform: 'translateY(0)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
          '100%': { transform: 'translateY(-2px)', boxShadow: '0 8px 25px rgba(0,0,0,0.15)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};
