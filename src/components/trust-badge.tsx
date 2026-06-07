import Image from "next/image";
import { siteConfig } from "@/lib/site-config";

/** IC&RC member-board badge + reciprocity line. */
export function TrustBadge() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
      <Image
        src="/brand/icrc-logo.png"
        alt="International Certification & Reciprocity Consortium (IC&RC)"
        width={96}
        height={33}
        className="h-8 w-auto"
      />
      <p className="text-sm text-muted">{siteConfig.icrcLine}</p>
    </div>
  );
}
