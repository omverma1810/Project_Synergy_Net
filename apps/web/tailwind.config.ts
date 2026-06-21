import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        synergy: {
          dark: '#0b1120',
          darker: '#070b15',
          card: '#141e33',
          'card-hover': '#1a263f',
          border: '#27324a',
          text: '#f1f5f9',
          muted: '#94a3b8',
          subtle: '#64748b',
          cyan: '#22d3ee',
          'cyan-deep': '#06b6d4',
          green: '#34d399',
          orange: '#fbbf24',
          gold: '#f5c451',
          red: '#f87171',
          blue: '#60a5fa',
          violet: '#a78bfa',
          magenta: '#e879f9',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      backgroundImage: {
        'aurora': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(34,211,238,0.15), transparent), radial-gradient(ellipse 60% 50% at 80% 50%, rgba(167,139,250,0.10), transparent), radial-gradient(ellipse 50% 40% at 10% 80%, rgba(52,211,153,0.08), transparent)',
        'gradient-cyan': 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
        'gradient-gold': 'linear-gradient(135deg, #f5c451 0%, #fbbf24 100%)',
        'gradient-violet': 'linear-gradient(135deg, #a78bfa 0%, #e879f9 100%)',
        'gradient-mesh': 'linear-gradient(135deg, #22d3ee, #3b82f6, #a78bfa, #e879f9)',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        'glow-cyan': '0 0 24px -4px rgba(34,211,238,0.45)',
        'glow-cyan-lg': '0 0 48px -8px rgba(34,211,238,0.55)',
        'glow-gold': '0 0 24px -4px rgba(245,196,81,0.45)',
        'glow-violet': '0 0 24px -4px rgba(167,139,250,0.45)',
        'card': '0 4px 24px -8px rgba(0,0,0,0.5)',
        'card-lg': '0 12px 48px -12px rgba(0,0,0,0.65)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'aurora-shift': {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '33%': { transform: 'translate(3%, -3%) rotate(2deg)' },
          '66%': { transform: 'translate(-3%, 3%) rotate(-2deg)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'gradient-pan': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.6' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) forwards',
        'scale-in': 'scale-in 0.4s cubic-bezier(0.22,1,0.36,1) forwards',
        'shimmer': 'shimmer 2s linear infinite',
        'aurora-shift': 'aurora-shift 18s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'gradient-pan': 'gradient-pan 6s ease infinite',
        'spin-slow': 'spin-slow 12s linear infinite',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [],
};
export default config;
