import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const variants = {
  primary: "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-sm shadow-primary/20 hover:-translate-y-0.5 hover:opacity-95 hover:shadow-md hover:shadow-primary/20",
  secondary: "bg-muted text-foreground hover:-translate-y-0.5 hover:bg-muted/80 hover:shadow-sm",
  ghost: "bg-transparent text-foreground hover:bg-muted hover:text-foreground",
  danger: "bg-destructive text-destructive-foreground hover:-translate-y-0.5 hover:bg-destructive/90 hover:shadow-sm"
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-all duration-200 ease-out active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
