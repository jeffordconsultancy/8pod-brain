import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        console: {
          bg: '#0a0f0d',
          surface: '#111a16',
          card: '#152019',
          border: '#1f3029',
          'border-hover': '#2a4038',
          'border-active': '#2dd4a8',
          muted: '#3a5548',
        },
        accent: {
          teal: '#2dd4a8',
          'teal-dim': '#1a8a6a',
          cyan: '#00d4ff',
          glow: 'rgba(45, 212, 168, 0.15)',
        },
        text: {
          primary: '#e8ede9',
          secondary: '#8a9b91',
          muted: '#5a6b62',
          dim: '#3a4b42',
        },
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-teal': '0 0 12px rgba(45, 212, 168, 0.15)',
        'glow-teal-lg': '0 0 24px rgba(45, 212, 168, 0.2)',
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
