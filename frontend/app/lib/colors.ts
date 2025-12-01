/**
 * Cohort Builder Color Palette
 * Centralized color definitions for consistent theming
 */

export enum PrimaryColor {
  PURPLE = '#8E42EE',
  ORANGE = '#F78E12',
  PINK = '#EC4899',
  CYAN = '#06B6D4',
  RED = '#FF004D',
  BLUE = '#3C5DE2',
  GREEN = '#24CF35',
  YELLOW = '#F7E217',
}

export enum SecondaryColor {
  PURPLE = '#936DC3',
  ORANGE = '#D98C30',
  PINK = '#D85C99',
  CYAN = '#21A3B9',
  RED = '#CC3361',
  BLUE = '#6173BD',
}

export enum NeutralColor {
  PURPLE = '#968AA6',
  ORANGE = '#A18768',
  PINK = '#AF859A',
  CYAN = '#3A91A0',
  RED = '#9F6073',
  BLUE = '#7A82A4',
}

/**
 * UI Theme Colors
 * Maps semantic meanings to palette colors
 */
export const UIColors = {
  // Primary actions and highlights
  primary: PrimaryColor.PURPLE,
  primaryHover: SecondaryColor.PURPLE,
  
  // Secondary actions
  secondary: SecondaryColor.BLUE,
  secondaryHover: NeutralColor.BLUE,
  
  // Success states
  success: PrimaryColor.GREEN,
  successSubtle: '#D1FAE5',
  
  // Warning states
  warning: PrimaryColor.YELLOW,
  warningSubtle: '#FEF3C7',
  
  // Error states
  error: PrimaryColor.RED,
  errorSubtle: '#FEE2E2',
  
  // Info states
  info: PrimaryColor.CYAN,
  infoSubtle: '#CFFAFE',
  
  // Neutral/Background
  background: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  
  // Text
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textOnPrimary: '#FFFFFF',
  
  // Chart colors (using the palette)
  chartColors: [
    PrimaryColor.PURPLE,
    PrimaryColor.BLUE,
    PrimaryColor.CYAN,
    PrimaryColor.PINK,
    PrimaryColor.ORANGE,
    PrimaryColor.GREEN,
    PrimaryColor.YELLOW,
    PrimaryColor.RED,
  ],
} as const;

/**
 * Helper to get opacity-adjusted color
 */
export const withOpacity = (color: string, opacity: number): string => {
  // Convert hex to rgba
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Status colors for different states
 */
export const StatusColors = {
  inclusion: PrimaryColor.GREEN,
  exclusion: PrimaryColor.RED,
  pending: PrimaryColor.YELLOW,
  processing: PrimaryColor.BLUE,
  completed: PrimaryColor.GREEN,
  failed: PrimaryColor.RED,
} as const;
