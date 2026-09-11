import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#f7f9fb',
          surface: '#ffffff',
          elevated: '#f1f5f9',
          hover: '#e5e9ee',
          input: '#ffffff',
        },
        border: {
          DEFAULT: '#e5e9ee',
          light: '#f1f5f9',
          subtle: '#f7f9fb',
          strong: '#cbd5e1',
        },
        accent: {
          DEFAULT: '#1d4ed8',
          hover: '#1e40af',
          soft: '#dbeafe',
          tint: '#dbeafe',
        },
        sky: {
          DEFAULT: '#1d4ed8',
          bright: '#38bdf8',
          soft: '#dbeafe',
        },
        green: {
          DEFAULT: '#10b981',
          muted: 'rgba(16, 185, 129, 0.12)',
          soft: 'rgba(16, 185, 129, 0.08)',
        },
        amber: {
          DEFAULT: '#f59e0b',
          muted: 'rgba(245, 158, 11, 0.12)',
        },
        red: {
          DEFAULT: '#ef4444',
          muted: 'rgba(239, 68, 68, 0.12)',
        },
        blue: {
          DEFAULT: '#1d4ed8',
          muted: 'rgba(29, 78, 216, 0.12)',
        },
        purple: {
          DEFAULT: '#8b5cf6',
          muted: 'rgba(139, 92, 246, 0.12)',
        },
        text: {
          primary: '#111827',
          secondary: '#6b7280',
          tertiary: '#9ca3af',
          muted: '#9ca3af',
        },
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
        xl: '20px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)',
        elevated: '0 4px 14px rgba(17, 24, 39, 0.06), 0 1px 3px rgba(17, 24, 39, 0.04)',
        modal: '0 20px 40px rgba(17, 24, 39, 0.12)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
