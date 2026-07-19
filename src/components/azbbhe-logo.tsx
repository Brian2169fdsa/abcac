import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_PUBLIC_PATH = "/brand/azbbhe-logo.png";

/**
 * Official Arizona Board of Behavioral Health Examiners logo, shown wherever
 * the site discusses AZBBHE. Renders nothing until the owner places the
 * official artwork at public/brand/azbbhe-logo.png (we do not redraw or
 * substitute a third party's logo), so pages degrade cleanly without it.
 */
export function AzbbheLogo({ className }: { className?: string }) {
  if (!existsSync(join(process.cwd(), "public", "brand", "azbbhe-logo.png"))) return null;
  return (
    <span className={cn("inline-flex items-center rounded-xl bg-white p-2.5 shadow-sm", className)}>
      <Image
        src={LOGO_PUBLIC_PATH}
        alt="Arizona Board of Behavioral Health Examiners"
        width={220}
        height={64}
        className="h-10 w-auto object-contain sm:h-12"
      />
    </span>
  );
}
