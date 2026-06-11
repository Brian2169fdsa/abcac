"use client";

// "Mark all read" control for the Notifications page header. Calls the shared
// markAllReadAction then refreshes so the list + bell badge update in place.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { markAllReadAction } from "@/app/(portal)/account/notifications/actions";

export function MarkAllReadButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onClick = () =>
    startTransition(async () => {
      await markAllReadAction();
      router.refresh();
    });

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-brand shadow-sm transition-colors hover:bg-bg/50 disabled:opacity-60"
    >
      <CheckCheck className="h-4 w-4" aria-hidden />
      {pending ? "Marking…" : "Mark all read"}
    </button>
  );
}
