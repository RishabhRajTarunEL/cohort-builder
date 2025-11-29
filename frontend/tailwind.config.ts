import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Font Family
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      
      // Colors - Polly Design System
      colors: {
        // Keep existing Tailwind colors
        transparent: 'transparent',
        current: 'currentColor',
        white: '#ffffff',
        black: '#000000',
        
        // Gray scale (Polly palette)
        gray: {
          50: '#f7f7f9',
          100: '#eceeef',
          200: '#e4e4e4',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6a6a6a',
          600: '#3a3a3a',
          700: '#242424',
          800: '#1f2937',
          900: '#111827',
        },
        
        // Polly Primary Purple
        purple: {
          50: '#F3EBFF',
          100: '#E7D7FF',
          200: '#CFAFFF',
          300: '#B787FF',
          400: '#9F5FFF',
          500: '#8E42EE', // Primary purple
          600: '#6A42EE', // Brand alt purple
          700: '#5632BB',
          800: '#421F8C',
          900: '#2E0D5D',
        },
        
        // Polly Primary Orange
        orange: {
          50: '#FFF4E6',
          100: '#FFE9CC',
          200: '#FFD399',
          300: '#FFBD66',
          400: '#FFA633',
          500: '#F78E12', // Primary orange
          600: '#D98C30', // Secondary orange
          700: '#A18768', // Neutral orange
          800: '#7A5E3E',
          900: '#523E29',
        },
        
        // Polly Primary Green
        green: {
          50: '#E8FCE9',
          100: '#D1F9D3',
          200: '#A3F3A7',
          300: '#75ED7B',
          400: '#47E74F',
          500: '#24CF35', // Primary green
          600: '#1DA62A',
          700: '#167D20',
          800: '#0F5415',
          900: '#082B0B',
        },
        
        // Polly Primary Blue
        blue: {
          50: '#EBF2FE',
          100: '#D7E5FD',
          200: '#AFCBFB',
          300: '#87B1F9',
          400: '#5F97F7',
          500: '#3C5DE2', // Primary blue
          600: '#6173BD', // Secondary blue
          700: '#2A43A5',
          800: '#1F327C',
          900: '#152153',
        },
        
        // Polly Primary Yellow
        yellow: {
          50: '#FEFCE5',
          100: '#FEF9CB',
          200: '#FDF397',
          300: '#FCED63',
          400: '#FBE72F',
          500: '#F7E217', // Primary yellow
          600: '#C6B512',
          700: '#94880E',
          800: '#635A09',
          900: '#312D05',
        },
        
        // Polly Primary Red
        red: {
          50: '#FFE6F0',
          100: '#FFCCE1',
          200: '#FF99C3',
          300: '#FF66A5',
          400: '#FF3387',
          500: '#FF004D', // Primary red
          600: '#CC3361', // Secondary red
          700: '#CC003E',
          800: '#99002E',
          900: '#66001F',
        },
        
        // Polly Primary Cyan
        teal: {
          50: '#E6F9FC',
          100: '#CCF3F9',
          200: '#99E7F3',
          300: '#66DBED',
          400: '#33CFE7',
          500: '#06B6D4', // Primary cyan
          600: '#21A3B9', // Secondary cyan
          700: '#048BA6',
          800: '#03687D',
          900: '#024554',
        },
        
        // Polly Primary Pink
        pink: {
          50: '#FCE9F5',
          100: '#F9D3EB',
          200: '#F3A7D7',
          300: '#ED7BC3',
          400: '#E74FAF',
          500: '#EC4899', // Primary pink
          600: '#D85C99', // Secondary pink
          700: '#AF859A', // Neutral pink
          800: '#8E1D6A',
          900: '#5F1347',
        },
        
        // CSS Variable Based Colors
        background: "var(--color-background)",
        
        primary: {
          DEFAULT: "var(--color-primary)",
          dark: "var(--color-primary-dark)",
          light: "var(--color-primary-light)",
        },
        
        accent: {
          DEFAULT: "var(--color-accent)",
          dark: "var(--color-accent-dark)",
          light: "var(--color-accent-light)",
        },
        
        text: {
          DEFAULT: "var(--color-text)",
          light: "var(--color-text-light)",
        },
        
        secondary: {
          DEFAULT: "var(--color-secondary)",
          dark: "var(--color-secondary-dark)",
        },
        
        border: "var(--color-border)",
        lightgray: "var(--color-light-gray)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        error: "var(--color-error)",
        info: "var(--color-info)",
      },
      
      // Box Shadow
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      
      // Border Radius
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-md)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      
      // Transition Duration
      transitionDuration: {
        fast: "var(--transition-fast)",
        DEFAULT: "var(--transition-normal)",
        normal: "var(--transition-normal)",
        slow: "var(--transition-slow)",
      },
      
      // Spacing (using CSS variables)
      spacing: {
        '1': "var(--space-1)",
        '2': "var(--space-2)",
        '3': "var(--space-3)",
        '4': "var(--space-4)",
        '6': "var(--space-6)",
        '8': "var(--space-8)",
      },
      
      // Animations
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slideUp 0.3s ease-out",
        "spin": "spin 1s linear infinite",
      },
      
      // Keyframes
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
        pulse: {
          "0%, 100%": {
            opacity: "1",
          },
          "50%": {
            opacity: "0.5",
          },
        },
        spin: {
          from: {
            transform: "rotate(0deg)",
          },
          to: {
            transform: "rotate(360deg)",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
