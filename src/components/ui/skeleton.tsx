import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rounded" | "rectangular";
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      className,
      variant = "rounded",
      width,
      height,
      animate = true,
      style,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      text: "h-3.5 w-full rounded",
      circular: "rounded-full shrink-0",
      rounded: "rounded-md",
      rectangular: "rounded-none",
    }[variant];

    const inlineStyle: React.CSSProperties = {
      width,
      height,
      ...style,
    };

    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={cn(
          "bg-white/[0.06]",
          animate && "animate-pulse motion-reduce:animate-none",
          variantClasses,
          className
        )}
        style={inlineStyle}
        {...props}
      />
    );
  }
);

Skeleton.displayName = "Skeleton";
