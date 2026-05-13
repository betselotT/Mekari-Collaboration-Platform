import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", hoverable = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-lg border border-neutral-200 bg-white p-6 shadow-sm transition-all dark:border-neutral-700 dark:bg-neutral-800 ${
          hoverable ? "hover:shadow-md hover:border-primary-200 dark:hover:border-primary-800" : ""
        } ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
