"use client";

import { type ReactNode, useState } from "react";

type AlertVariant = "success" | "error" | "warning" | "info";

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  dismissible?: boolean;
  className?: string;
  onDismiss?: () => void;
}

export default function Alert({
  variant = "info",
  title,
  children,
  dismissible = true,
  className = "",
  onDismiss,
}: AlertProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  // Use application color variables to match the app's design system
  const accentColor = {
    success: "var(--color-success)",
    error: "var(--color-error)",
    warning: "var(--color-warning)",
    info: "var(--color-info)",
  };

  const iconClasses = {
    success: "text-success",
    error: "text-error",
    warning: "text-warning",
    info: "text-info",
  };

  // Simple SVG icons
  const icons = {
    success: (
      <svg className={`h-5 w-5 ${iconClasses.success}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className={`h-5 w-5 ${iconClasses.error}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className={`h-5 w-5 ${iconClasses.warning}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className={`h-5 w-5 ${iconClasses.info}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div
      className={`border border-gray-300 bg-opacity-90 shadow-xl bg-white rounded-sm p-3 ${className}`}
      style={{ borderLeftWidth: "3px", borderLeftColor: accentColor[variant] }}
    >
      <div className="flex">
        {/* Icon */}
        <div className="flex-shrink-0 mr-3">{icons[variant]}</div>

        {/* Content */}
        <div className="flex-grow">
          {title && <h3 className="text-sm font-medium">{title}</h3>}
          <div className="text-sm">{children}</div>
        </div>

        {/* Dismiss button */}
        {dismissible && (
          <button
            type="button"
            onClick={() => {
              setIsDismissed(true);
              if (onDismiss) onDismiss();
            }}
            className="flex-shrink-0 h-5 ml-3"
          >
            <span className="sr-only">Dismiss</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
