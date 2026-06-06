import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CtaButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline" | "accent" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}

/** A link styled as a button — the standard call-to-action across the site. */
export function CtaButton({ href, children, variant = "primary", size = "default", className }: CtaButtonProps) {
  const external = href.startsWith("http");
  if (external) {
    return (
      <a href={href} className={cn(buttonVariants({ variant, size }), className)} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </Link>
  );
}
