import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#09090b',
          900: '#121216',
          800: '#1c1c22',
        },
      },
    },
  },
  plugins: [],
};

export default config;
