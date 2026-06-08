import { cn } from "@/lib/utils";

/**
 * Small pill used for counts/status accents (e.g. unread Messages count in the
 * portal top bar and sidebar). Defaults to the maroon brand fill.
 */
export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white",
        className,
      )}
      {...props}
    />
  );
}
