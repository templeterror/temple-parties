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
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Purple color system (redesign)
        temple: {
          purple: '#b24bf3',
          'purple-light': '#e0d4ff',
          'purple-dark': '#252525',
          green: '#10B981',
          'green-dark': '#059669',
          card: 'rgba(40,40,40,0.5)',
          'card-info': 'rgba(40,40,40,0.9)',
          // WF-B2 surfaces — same purple brand, darker card stack than v1 glass
          surface: '#1a1a1d',
          'surface-2': '#252528',
          muted: '#9a9a9a',
          // HYPED accent lives as a CSS var in globals.css :root so the
          // hand-rolled Leaflet popup CSS can read the exact same value.
          // Caveat: var-backed colors don't support Tailwind opacity
          // modifiers (text-temple-hyped/50 won't work) — use them solid.
          hyped: 'var(--temple-hyped)',
          'hyped-ink': 'var(--temple-hyped-ink)',
        },
      },
      boxShadow: {
        'purple-glow': '0 4px 20px rgba(178, 75, 243, 0.3)',
        'purple-glow-lg': '0 8px 30px rgba(178, 75, 243, 0.4)',
        'green-glow': '0 4px 16px rgba(16, 185, 129, 0.4)',
        // The app's one glow — sits under the HYPED badge (WF-B2). If the
        // hyped accent ever changes, update this rgba alongside the :root vars.
        'hyped-glow': '0 0 12px 1px rgba(255, 214, 10, 0.45)',
      },
      fontFamily: {
        'bitcount': ['"Bitcount Prop Single"', 'sans-serif'],
        'basement': ['"Basement Grotesque"', 'sans-serif'],
        'montserrat-alt': ['"Montserrat Alternates"', 'sans-serif'],
        'montserrat': ['Montserrat', 'sans-serif'],
        'helvetica': ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        logo: ['Garamond', 'Georgia', 'Times New Roman', 'serif'],
        georgia: ['Georgia', 'Times New Roman', 'serif'],
        sans: ['Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translate(-50%, 20px)' },
          '100%': { opacity: '1', transform: 'translate(-50%, 0)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 15px rgba(178, 75, 243, 0.4)' },
          '50%': { boxShadow: '0 0 25px rgba(178, 75, 243, 0.7)' },
        },
        'slide-up-fade': {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        'host-prompt-in': {
          from: { opacity: '0', transform: 'translateY(110%)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'number-pop': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.3)' },
          '100%': { transform: 'scale(1)' },
        },
        'going-click': {
          '0%': { transform: 'scale(0.95)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-up-fade': 'slide-up-fade 400ms ease-out',
        'host-prompt-in': 'host-prompt-in 520ms cubic-bezier(0.22, 1, 0.36, 1)',
        'number-pop': 'number-pop 300ms ease-out',
        'going-click': 'going-click 300ms ease-out',
      },
    },
  },
  plugins: [],
};
export default config;
