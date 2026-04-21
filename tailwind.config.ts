import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          500: '#14b8a6',
          600: '#0d9488'
        }
      },
      boxShadow: {
        brand: '0 4px 6px -1px rgb(20 184 166 / 0.3), 0 2px 4px -2px rgb(20 184 166 / 0.3)'
      }
    }
  },
  plugins: []
};

export default config;