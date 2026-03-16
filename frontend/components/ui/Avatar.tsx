import React from "react";
import Image from "next/image";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  initials?: string;
  size?: "sm" | "md" | "lg" | "xl";
  status?: "online" | "offline" | "away";
}

const sizeStyles = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

const statusStyles = {
  online: "bg-emerald-500",
  offline: "bg-neutral-400",
  away: "bg-amber-500",
};

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className = "", src, alt = "Avatar", initials = "?", size = "md", status, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`relative inline-flex items-center justify-center flex-shrink-0 rounded-full overflow-hidden ${sizeStyles[size]} bg-gradient-to-br from-primary-400 to-primary-600 text-white font-semibold ${className}`}
        {...props}
      >
        {src ? (
          <Image
            src={src}
            alt={alt}
            fill
            className="object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
        
        {status && (
          <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${statusStyles[status]}`} />
        )}
      </div>
    );
  }
);

Avatar.displayName = "Avatar";
