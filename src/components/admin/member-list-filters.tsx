"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const field =
  "h-9 rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "applying", label: "Applying" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
  { value: "superadmin", label: "Superadmin" },
];

/**
 * Client filter bar for the admin member directory. State lives in the URL
 * (`?q=&status=&role=`) so the server page can read `searchParams`, filter the
 * query, and the view stays shareable/bookmarkable. The text input is
 * debounced; the selects apply immediately.
 */
export function MemberListFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const status = searchParams.get("status") ?? "";
  const role = searchParams.get("role") ?? "";

  // Keep the local text input in sync when the URL changes externally
  // (e.g. the Clear button or browser navigation).
  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushParams(next: { q?: string; status?: string; role?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const apply = (key: string, value: string) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };
    if (next.q !== undefined) apply("q", next.q.trim());
    if (next.status !== undefined) apply("status", next.status);
    if (next.role !== undefined) apply("role", next.role);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function onQueryChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushParams({ q: value }), 300);
  }

  function clearAll() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQ("");
    router.replace(pathname, { scroll: false });
  }

  const hasFilters = Boolean(q || status || role);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={q}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search by name or email…"
        aria-label="Search members"
        className={`${field} min-w-[14rem] flex-1`}
      />
      <select
        value={status}
        onChange={(e) => pushParams({ status: e.target.value })}
        aria-label="Filter by account status"
        className={field}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        value={role}
        onChange={(e) => pushParams({ role: e.target.value })}
        aria-label="Filter by role"
        className={field}
      >
        {ROLE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hasFilters && (
        <Button size="sm" variant="outline" onClick={clearAll}>
          Clear
        </Button>
      )}
    </div>
  );
}
