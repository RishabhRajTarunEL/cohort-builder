import React from 'react';
import { Loader2 } from 'lucide-react';

export type IconButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'tonal' | 'elevated' | 'accent' | 'danger';
export type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
  icon: React.ReactNode;
  'aria-label': string; // Required for accessibility
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (props, ref) => {
    const {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      disabled = false,
      className = '',
      'aria-label': ariaLabel,
      ...restProps
    } = props;
    // Base styles
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed';

    // Variant styles
    const variantStyles: Record<IconButtonVariant, string> = {
      primary: disabled
        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
        : 'bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800 focus:ring-purple-500 shadow-sm hover:shadow-md',
      accent: disabled
        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
        : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:ring-blue-500 shadow-sm hover:shadow-md',
      danger: disabled
        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
        : 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-500 shadow-sm hover:shadow-md',
      secondary: disabled
        ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 active:bg-gray-100 focus:ring-gray-400 shadow-sm',
      tertiary: disabled
        ? 'bg-transparent text-gray-400 cursor-not-allowed'
        : 'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200 focus:ring-gray-400',
      tonal: disabled
        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
        : 'bg-purple-100 text-purple-700 hover:bg-purple-200 active:bg-purple-300 focus:ring-purple-500',
      elevated: disabled
        ? 'bg-gray-100 text-gray-400 shadow-sm cursor-not-allowed'
        : 'bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 focus:ring-gray-400 shadow-md hover:shadow-lg'
    };

    // Size styles
    const sizeStyles: Record<IconButtonSize, string> = {
      sm: 'p-1.5 w-8 h-8',
      md: 'p-2 w-10 h-10',
      lg: 'p-3 w-12 h-12'
    };

    const iconSizeStyles: Record<IconButtonSize, string> = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6'
    };

    const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`.trim();

    return (
      <button
        ref={ref}
        className={combinedClassName}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        {...restProps}
      >
        {loading ? (
          <Loader2 className={`${iconSizeStyles[size]} animate-spin`} />
        ) : (
          <span className={`${iconSizeStyles[size]} flex items-center justify-center`}>{icon}</span>
        )}
      </button>
    );
  });

IconButton.displayName = 'IconButton';

export default IconButton;
