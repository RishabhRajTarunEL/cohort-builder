interface LoadingProps {
  size?: "sm" | "md" | "lg";
  text?: string;
}

export default function Loading({ size = "md", text }: LoadingProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-3",
    lg: "h-12 w-12 border-4",
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div
        className={`${sizeClasses[size]} border-primary border-t-transparent rounded-full animate-spin`}
      ></div>
      {text && <p className="mt-2 text-sm text-text-light">{text}</p>}
    </div>
  );
}
