import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import type { ButtonVariant, ButtonSize } from './Button';

interface SplitButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onMainClick?: () => void;
  menuItems?: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
  }>;
  className?: string;
}

const SplitButton: React.FC<SplitButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  children,
  onMainClick,
  menuItems = [],
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Base styles
  const baseStyles = 'inline-flex items-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed';

  // Variant styles for main button
  const variantStyles: Record<ButtonVariant, string> = {
    primary: disabled
      ? 'bg-gray-300 text-gray-500'
      : 'bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800 focus:ring-purple-500',
    accent: disabled
      ? 'bg-gray-300 text-gray-500'
      : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:ring-blue-500',
    danger: disabled
      ? 'bg-gray-300 text-gray-500'
      : 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-500',
    secondary: disabled
      ? 'bg-gray-100 text-gray-400 border border-gray-200'
      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 active:bg-gray-100 focus:ring-gray-400',
    tertiary: disabled
      ? 'bg-transparent text-gray-400'
      : 'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200 focus:ring-gray-400',
    tonal: disabled
      ? 'bg-gray-100 text-gray-400'
      : 'bg-purple-100 text-purple-700 hover:bg-purple-200 active:bg-purple-300 focus:ring-purple-500',
    elevated: disabled
      ? 'bg-gray-100 text-gray-400 shadow-sm'
      : 'bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 focus:ring-gray-400 shadow-md hover:shadow-lg',
  };

  // Size styles
  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'text-sm',
    md: 'text-sm',
    lg: 'text-base',
  };

  const mainButtonPadding: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5',
    md: 'px-4 py-2',
    lg: 'px-6 py-3',
  };

  const dropdownButtonPadding: Record<ButtonSize, string> = {
    sm: 'px-2 py-1.5',
    md: 'px-2.5 py-2',
    lg: 'px-3 py-3',
  };

  const iconSize: Record<ButtonSize, string> = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const dividerClass = variant === 'secondary' 
    ? 'border-l border-gray-300' 
    : variant === 'tertiary'
    ? 'border-l border-gray-300'
    : 'border-l border-white border-opacity-30';

  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`.trim();

  return (
    <div className="relative inline-flex" ref={dropdownRef}>
      <div className={combinedClassName}>
        {/* Main Button */}
        <button
          onClick={onMainClick}
          disabled={disabled || loading}
          className={`${mainButtonPadding[size]} flex items-center gap-2 rounded-l-lg`}
        >
          {loading ? (
            <Loader2 className={`${iconSize[size]} animate-spin`} />
          ) : icon ? (
            <span className={iconSize[size]}>{icon}</span>
          ) : null}
          <span>{children}</span>
        </button>

        {/* Divider */}
        <div className={dividerClass} />

        {/* Dropdown Button */}
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled || loading}
          className={`${dropdownButtonPadding[size]} rounded-r-lg flex items-center justify-center`}
        >
          <ChevronDown className={`${iconSize[size]} transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && menuItems.length > 0 && (
        <div className="absolute top-full mt-1 right-0 min-w-[200px] bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                if (!item.disabled) {
                  item.onClick();
                  setIsOpen(false);
                }
              }}
              disabled={item.disabled}
              className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                item.disabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.icon && <span className="w-4 h-4">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SplitButton;
