import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
  helpText?: string;
}

export default function FormField({
  label,
  htmlFor,
  error,
  required = false,
  className = "",
  children,
  helpText,
}: FormFieldProps) {
  return (
    <div className={`form-group ${className}`}>
      <label htmlFor={htmlFor} className="form-label">
        {label}
        {required && <span className="text-error ml-1">*</span>}
      </label>
      {children}
      {helpText && <p className="text-text-light text-xs mt-1">{helpText}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
