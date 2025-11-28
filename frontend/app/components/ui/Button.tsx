import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "tertiary" | "elevated" | "tonal" | "danger" | "text";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  isLoading = false,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  // Variant styles
  const variantStyles = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    tertiary: "btn-tertiary",
    elevated: "btn-elevated",
    tonal: "btn-tonal",
    danger: "btn-danger",
    text: "btn-text",
  };

  // Size styles
  const sizeStyles = {
    sm: "text-sm py-1 px-3",
    md: "py-2 px-4",
    lg: "text-lg py-3 px-6",
  };

  const widthStyle = fullWidth ? "w-full" : "";
  const loadingStyles = isLoading ? "opacity-70 cursor-not-allowed" : "";
  const disabledStyles = disabled ? "opacity-50 cursor-not-allowed" : "";

  return (
    <button
      className={`flex items-center justify-center ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${loadingStyles} ${disabledStyles} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
