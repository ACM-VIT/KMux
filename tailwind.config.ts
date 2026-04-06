import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#020617',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'Aptos', 'Segoe UI Variable', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Cascadia Code', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
