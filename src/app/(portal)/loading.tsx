import { Loader2 } from "lucide-react";

export default function PortalLoading() {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3 text-muted">
      <Loader2 className="h-5 w-5 animate-spin text-brand-600" aria-hidden="true" />
      <span className="text-sm">Loading&hellip;</span>
    </div>
  );
}
