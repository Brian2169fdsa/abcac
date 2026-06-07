"use client";

import { Button } from "@/components/ui/button";
import { CtaButton } from "@/components/cta-button";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[40vh] flex items-center justify-center px-4">
      <div className="bg-surface border border-line rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-sm">
        <h2 className="text-xl font-semibold text-ink">Something went wrong</h2>
        <p className="text-sm text-muted">
          An unexpected error occurred. You can try again or return to your account dashboard.
        </p>
        {error.digest && (
          <p className="text-xs text-muted font-mono">Error ID: {error.digest}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button onClick={reset} variant="primary">
            Try again
          </Button>
          <CtaButton href="/account" variant="outline">Go to account</CtaButton>
        </div>
      </div>
    </div>
  );
}
