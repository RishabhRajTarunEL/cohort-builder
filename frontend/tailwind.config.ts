import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      colors: {
        // Primary colors
        purple: {
          DEFAULT: '#8E42EE',
          light: '#936DC3',
          lighter: '#968AA6',
        },
        orange: {
          DEFAULT: '#F78E12',
          light: '#D98C30',
          lighter: '#A18768',
        },
        pink: {
          DEFAULT: '#EC4899',
          light: '#D85C99',
          lighter: '#AF859A',
        },
        cyan: {
          DEFAULT: '#06B6D4',
          light: '#21A3B9',
          lighter: '#3A91A0',
        },
        red: {
          DEFAULT: '#FF004D',
          light: '#CC3361',
          lighter: '#9F6073',
        },
        blue: {
          DEFAULT: '#3C5DE2',
          light: '#6173BD',
          lighter: '#7A82A4',
        },
        green: {
          DEFAULT: '#24CF35',
        },
        yellow: {
          DEFAULT: '#F7E217',
        },
        
        // Semantic colors
        primary: {
          DEFAULT: '#8E42EE',
          hover: '#936DC3',
          light: '#968AA6',
        },
        secondary: {
          DEFAULT: '#6173BD',
          hover: '#7A82A4',
        },
        success: {
          DEFAULT: '#24CF35',
          bg: '#D1FAE5',
        },
        warning: {
          DEFAULT: '#F7E217',
          bg: '#FEF3C7',
        },
        error: {
          DEFAULT: '#FF004D',
          bg: '#FEE2E2',
        },
        info: {
          DEFAULT: '#06B6D4',
          bg: '#CFFAFE',
        },
        
        // UI colors
        background: '#F9FAFB',
        surface: '#FFFFFF',
        border: '#E5E7EB',
        
        // Text colors
        text: {
          DEFAULT: '#111827',
          secondary: '#6B7280',
          tertiary: '#9CA3AF',
        },
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
        xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
        "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.5rem",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
      },
      keyframes: {
        slideUp: {
          from: {
            opacity: "0",
            transform: "translateY(1rem)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        slideDown: {
          from: {
            opacity: "0",
            transform: "translateY(-1rem)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        fadeIn: {
          from: {
            opacity: "0",
          },
          to: {
            opacity: "1",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
