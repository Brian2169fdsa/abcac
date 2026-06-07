"use client";

import { useState, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface Result {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  account_status: string | null;
  portal_role: string | null;
}

type SearchState = "idle" | "loading" | "done" | "error";

export function AdminSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function runSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }

    setState("loading");
    setErrorMsg(null);
    setResults([]);

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id,first_name,last_name,email,account_status,portal_role")
      .or(
        `first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`
      )
      .limit(25);

    if (error) {
      setState("error");
      setErrorMsg(error.message ?? "An unexpected error occurred.");
      return;
    }

    const rows: Result[] = (data ?? []).map((row: any) => ({
      id: row.id as string,
      first_name: row.first_name ?? null,
      last_name: row.last_name ?? null,
      email: row.email ?? null,
      account_status: row.account_status ?? null,
      portal_role: row.portal_role ?? null,
    }));

    setResults(rows);
    setState("done");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      runSearch(query);
    }
  }

  function displayName(r: Result): string {
    return [r.first_name, r.last_name].filter(Boolean).join(" ") || "—";
  }

  return (
    <div>
      {/* Search bar */}
      <div className="mb-6 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by name or email…"
          className="flex-1 rounded-lg border border-line bg-surface px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
        />
        <Button
          onClick={() => runSearch(query)}
          disabled={state === "loading"}
        >
          {state === "loading" ? "Searching…" : "Search"}
        </Button>
      </div>

      {/* Error */}
      {state === "error" && (
        <p className="mb-4 text-sm text-red-500">{errorMsg}</p>
      )}

      {/* Pre-search hint */}
      {state === "idle" && (
        <p className="text-sm text-muted">
          Enter a name or email address above to find a member.
        </p>
      )}

      {/* No results */}
      {state === "done" && results.length === 0 && (
        <p className="text-sm text-muted">No matches found.</p>
      )}

      {/* Results table */}
      {state === "done" && results.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Account Status</th>
                <th className="px-5 py-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-semibold">{displayName(r)}</td>
                  <td className="px-5 py-3 text-muted">{r.email ?? "—"}</td>
                  <td className="px-5 py-3 capitalize text-muted">
                    {(r.account_status ?? "—").replace(/_/g, " ")}
                  </td>
                  <td className="px-5 py-3 capitalize text-muted">
                    {(r.portal_role ?? "—").replace(/_/g, " ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
