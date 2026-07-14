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
          DEFAULT: '#0a0e14',
          surface: '#11161e',
          elevated: '#161c26',
          hover: '#1a2130',
          input: '#0d1117',
        },
        border: {
          DEFAULT: '#1e2a3a',
          light: '#243044',
        },
        green: {
          DEFAULT: '#00e676',
          muted: 'rgba(0, 230, 118, 0.12)',
          soft: 'rgba(0, 230, 118, 0.08)',
        },
        amber: {
          DEFAULT: '#ffb300',
          muted: 'rgba(255, 179, 0, 0.12)',
        },
        red: {
          DEFAULT: '#ff5252',
          muted: 'rgba(255, 82, 82, 0.12)',
        },
        blue: {
          DEFAULT: '#4dabf7',
          muted: 'rgba(77, 171, 247, 0.12)',
        },
        purple: {
          DEFAULT: '#c084fc',
          muted: 'rgba(192, 132, 252, 0.12)',
        },
        text: {
          primary: '#e8edf4',
          secondary: '#8b949e',
          tertiary: '#5c6670',
          muted: '#3d4650',
        },
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
        xl: '20px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
        elevated: '0 8px 24px rgba(0, 0, 0, 0.5)',
        modal: '0 20px 60px rgba(0, 0, 0, 0.7)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
