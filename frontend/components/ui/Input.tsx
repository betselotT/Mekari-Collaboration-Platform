import React from "react";
import { Search } from "lucide-react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ComponentType<{ className?: string }>;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", icon: Icon, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        <div className="relative">
          {Icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <input
            ref={ref}
            className={`input ${Icon ? "pl-10" : ""} ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""} ${className}`}
            {...props}
          />
        </div>
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";

// SearchInput component
export const SearchInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "icon">>(
  (props, ref) => {
    return <Input ref={ref} icon={Search} placeholder="Search..." {...props} />;
  }
);

SearchInput.displayName = "SearchInput";
