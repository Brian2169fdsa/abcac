import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative isolate inline-flex max-w-full items-center justify-center gap-2 rounded-xl text-center text-sm font-semibold leading-snug transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-white shadow-[0_12px_28px_-14px_rgba(123,31,31,0.8)] hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-[0_18px_34px_-14px_rgba(123,31,31,0.7)]",
        outline:
          "border border-brand/30 bg-surface/80 text-brand shadow-sm backdrop-blur hover:-translate-y-0.5 hover:border-brand hover:bg-brand hover:text-white hover:shadow-[0_12px_26px_-16px_rgba(123,31,31,0.55)]",
        ghost: "text-brand hover:bg-brand/[0.07]",
        accent:
          "bg-info text-white shadow-[0_12px_28px_-16px_rgba(13,34,63,0.7)] hover:-translate-y-0.5 hover:bg-info/90",
      },
      size: {
        default: "min-h-11 px-5 py-3",
        sm: "min-h-10 px-4 py-2.5 text-sm",
        lg: "min-h-[52px] px-7 py-3.5 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
