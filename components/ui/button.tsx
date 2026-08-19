import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-brass-dark",
  secondary: "border border-ink text-ink hover:bg-ink hover:text-paper",
  danger: "border border-stamp text-stamp hover:bg-stamp hover:text-paper",
  ghost: "text-ink-soft hover:text-ink",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`rounded-tag px-5 py-2.5 font-display font-semibold text-xs uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
