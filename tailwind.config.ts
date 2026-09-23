import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070708',
          900: '#0c0c0e',
          800: '#16161a',
          700: '#222228',
        },
      },
    },
  },
  plugins: [],
};

export default config;
