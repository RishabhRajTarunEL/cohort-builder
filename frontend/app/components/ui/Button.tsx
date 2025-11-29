import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'tonal' | 'elevated' | 'accent' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    const {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      disabled = false,
      className = '',
      children,
      ...restProps
    } = props;
    // Base styles - Polly uses rounded corners (5px) and bold font
    const baseStyles = 'inline-flex items-center justify-center font-bold rounded-[5px] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed';

    // Variant styles - Polly Design System
    const variantStyles: Record<ButtonVariant, string> = {
      primary: disabled
        ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
        : 'bg-purple-500 text-white hover:bg-purple-700 active:bg-purple-600 focus:ring-purple-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_1px_rgba(0,0,0,0.075)]',
      accent: disabled
        ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
        : 'bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 focus:ring-orange-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_1px_rgba(0,0,0,0.075)]',
      danger: disabled
        ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
        : 'bg-red-500 text-white hover:bg-red-600 active:bg-red-600 focus:ring-red-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_1px_rgba(0,0,0,0.075)]',
      secondary: disabled
        ? 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed opacity-50'
        : 'bg-white text-gray-700 border border-gray-200 hover:bg-purple-100 hover:border-purple-500 active:bg-purple-100 active:border-purple-700 focus:ring-purple-500',
      tertiary: disabled
        ? 'bg-transparent text-gray-400 cursor-not-allowed opacity-50'
        : 'bg-transparent text-gray-700 hover:bg-purple-100 active:bg-purple-200 focus:ring-purple-500',
      tonal: disabled
        ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
        : 'bg-purple-100 text-purple-700 hover:bg-purple-200 active:bg-purple-300 focus:ring-purple-500',
      elevated: disabled
        ? 'bg-gray-100 text-gray-400 shadow-sm cursor-not-allowed opacity-50'
        : 'bg-white text-gray-700 hover:bg-purple-50 active:bg-purple-100 focus:ring-purple-500 shadow-[0_2px_4px_0_rgba(0,0,0,0.25)]'
    };

    // Size styles - Polly uses 0.75rem (12px) font size
    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'px-3 py-1 text-xs gap-1.5',
      md: 'px-4 py-2 text-[0.75rem] gap-2',
      lg: 'px-6 py-2.5 text-sm gap-2.5'
    };

    // Width styles
    const widthStyles = fullWidth ? 'w-full' : '';

    // Icon only styles
    const iconOnlyStyles = !children ? (size === 'sm' ? 'p-1.5' : size === 'md' ? 'p-2' : 'p-3') : '';

    const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyles} ${iconOnlyStyles} ${className}`.trim();

    const iconSizeClass = size === 'sm' ? 'w-3.5 h-3.5' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5';

    const renderIcon = (position: 'left' | 'right') => {
      if (loading && position === 'left') {
        return <Loader2 className={`${iconSizeClass} animate-spin flex-shrink-0`} />;
      }
      if (icon && iconPosition === position && !loading) {
        return <span className={`${iconSizeClass} flex items-center justify-center flex-shrink-0`}>{icon}</span>;
      }
      return null;
    };

    return (
      <button
        ref={ref}
        className={combinedClassName}
        disabled={disabled || loading}
        {...restProps}
      >
        {renderIcon('left')}
        {children && <span>{children}</span>}
        {renderIcon('right')}
      </button>
    );
  });

Button.displayName = 'Button';

export default Button;
