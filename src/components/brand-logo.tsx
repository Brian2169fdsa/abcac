import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  priority?: boolean;
}

export function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/brand/abcac-wordmark.png"
      alt="ABCAC"
      width={163}
      height={56}
      priority={priority}
      className={cn("h-12 w-auto", className)}
    />
  );
}
