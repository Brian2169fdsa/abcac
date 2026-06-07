import { formatPrice, type Product } from "@/lib/catalog";
import { cn } from "@/lib/utils";

interface PriceTagProps {
  product: Pick<Product, "price" | "mode" | "interval">;
  className?: string;
}

/** Formats a catalog price with its billing suffix (one-time, /mo, /yr). */
export function PriceTag({ product, className }: PriceTagProps) {
  const formatted = formatPrice(product);
  const [amount, ...rest] = formatted.split(" ");
  return (
    <span className={cn("font-display font-bold text-ink", className)}>
      {amount}
      {rest.length > 0 && <span className="ml-1 text-base font-semibold text-muted">{rest.join(" ")}</span>}
    </span>
  );
}
