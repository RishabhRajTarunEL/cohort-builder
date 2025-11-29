import React from 'react';

export type TagVariant = 'purple' | 'orange' | 'green' | 'blue' | 'red' | 'teal' | 'pink' | 'yellow' | 'gray';
export type TagStyle = 'dark' | 'light';
export type TagSize = 'sm' | 'md' | 'lg';

interface TagProps {
  variant?: TagVariant;
  style?: TagStyle;
  size?: TagSize;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

const Tag: React.FC<TagProps> = ({
  variant = 'purple',
  style = 'dark',
  size = 'md',
  children,
  onClose,
  className = '',
}) => {
  // Base styles - Polly uses rounded tags
  const baseStyles = 'inline-flex items-center gap-1.5 rounded font-medium transition-colors duration-200 whitespace-nowrap';

  // Variant and style combinations - Polly Palette
  const variantStyles: Record<TagVariant, Record<TagStyle, string>> = {
    purple: {
      dark: 'bg-purple-500 text-white hover:bg-purple-600 active:bg-purple-700',
      light: 'bg-purple-100 text-purple-700 hover:bg-purple-200 active:bg-purple-300',
    },
    orange: {
      dark: 'bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700',
      light: 'bg-orange-100 text-orange-700 hover:bg-orange-200 active:bg-orange-300',
    },
    green: {
      dark: 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700',
      light: 'bg-green-100 text-green-700 hover:bg-green-200 active:bg-green-300',
    },
    blue: {
      dark: 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700',
      light: 'bg-blue-100 text-blue-700 hover:bg-blue-200 active:bg-blue-300',
    },
    red: {
      dark: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700',
      light: 'bg-red-100 text-red-700 hover:bg-red-200 active:bg-red-300',
    },
    teal: {
      dark: 'bg-teal-500 text-white hover:bg-teal-600 active:bg-teal-700',
      light: 'bg-teal-100 text-teal-700 hover:bg-teal-200 active:bg-teal-300',
    },
    pink: {
      dark: 'bg-pink-500 text-white hover:bg-pink-600 active:bg-pink-700',
      light: 'bg-pink-100 text-pink-700 hover:bg-pink-200 active:bg-pink-300',
    },
    yellow: {
      dark: 'bg-yellow-500 text-white hover:bg-yellow-600 active:bg-yellow-700',
      light: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 active:bg-yellow-300',
    },
    gray: {
      dark: 'bg-gray-500 text-white hover:bg-gray-600 active:bg-gray-700',
      light: 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300',
    },
  };

  // Size styles
  const sizeStyles: Record<TagSize, string> = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-sm',
  };

  const closeBtnSize: Record<TagSize, string> = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-4 h-4',
  };

  const combinedClassName = `${baseStyles} ${variantStyles[variant][style]} ${sizeStyles[size]} ${className}`.trim();

  return (
    <span className={combinedClassName}>
      <span className="max-w-full truncate">{children}</span>
      {onClose && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={`${closeBtnSize[size]} flex items-center justify-center rounded-sm hover:bg-black hover:bg-opacity-10 transition-colors`}
          aria-label="Remove tag"
        >
          <svg
            className="w-full h-full"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </span>
  );
};

export default Tag;
