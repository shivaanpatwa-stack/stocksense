/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#070d1a',
          card: '#0c1526',
          elevated: '#111d33',
          hover: '#162240',
        },
        blue: {
          DEFAULT: '#1a6fff',
          dim: 'rgba(26,111,255,0.12)',
          glow: 'rgba(26,111,255,0.25)',
          bright: '#4d8fff',
        },
        border: {
          DEFAULT: 'rgba(26,111,255,0.18)',
          dim: 'rgba(26,111,255,0.08)',
          bright: 'rgba(26,111,255,0.35)',
        },
        text: {
          primary: '#e8edf7',
          secondary: '#8a9bbf',
          muted: '#4a5a7a',
        },
        green: {
          signal: '#00d4a0',
          dim: 'rgba(0,212,160,0.12)',
        },
        red: {
          signal: '#ff4d6a',
          dim: 'rgba(255,77,106,0.12)',
        },
        amber: {
          signal: '#ffb547',
          dim: 'rgba(255,181,71,0.12)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}
