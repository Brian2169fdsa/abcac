"use client";

import { buttonVariants } from "@/components/ui/button";

export function ExportButton() {
  return (
    <a
      href="/api/account/export"
      className={buttonVariants({ variant: "outline", size: "default" })}
      download
    >
      Download my data (JSON)
    </a>
  );
}
