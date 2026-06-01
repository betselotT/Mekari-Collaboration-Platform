import React from "react";
import { Search } from "lucide-react";
import { useLanguage } from "../../lib/i18n";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ComponentType<{ className?: string }>;
  error?: string;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", icon: Icon, error, label, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {label}
          </label>
        )}
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
    const { t } = useLanguage();
    return <Input ref={ref} icon={Search} placeholder={t("Search...")} {...props} />;
  }
);

SearchInput.displayName = "SearchInput";
