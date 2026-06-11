import { vi } from "vitest";

// ---------------------------------------------------------------------------
// Chainable fake Supabase client for server-action unit tests.
//
// Every query method (.select/.update/.insert/.delete/.eq/.maybeSingle/...) is
// a vi.fn() that returns the same thenable builder, so arbitrary chains resolve
// to a configured { data, error } result. Per-table results are supplied via a
// resolver keyed on the table name AND the leading operation (select/insert/
// update/delete), allowing e.g. a "profiles" select to differ from a
// "profiles" update on the same client.
// ---------------------------------------------------------------------------

export type QueryResult = { data?: unknown; error?: unknown };
export type Op = "select" | "insert" | "update" | "delete";

export type ResultFor = (table: string, op: Op) => QueryResult;

export type RecordedCall = {
  table: string;
  op: Op;
  /** Argument passed to the op method (insert payload / update patch / etc.). */
  payload: unknown;
  /** Recorded .eq(col, val) filters applied in this chain, in order. */
  filters: Array<{ col: string; val: unknown }>;
};

export type FakeClient = {
  client: {
    auth: { getUser: ReturnType<typeof vi.fn> };
    from: ReturnType<typeof vi.fn>;
  };
  /** All terminal ops recorded across every chain on this client. */
  calls: RecordedCall[];
  /** Convenience: find recorded calls for a table/op. */
  callsFor: (table: string, op?: Op) => RecordedCall[];
};

const DEFAULT: QueryResult = { data: null, error: null };

/**
 * Build a chainable fake.
 * @param user      the auth user returned by auth.getUser() (or null)
 * @param resultFor resolves the { data, error } for a given (table, op)
 */
export function makeClient(
  user: { id: string } | null,
  resultFor: ResultFor = () => DEFAULT,
): FakeClient {
  const calls: RecordedCall[] = [];

  const from = vi.fn((table: string) => {
    // One record per chain; op + payload are filled by the first op method.
    const record: RecordedCall = { table, op: "select", payload: undefined, filters: [] };
    let started = false;

    const resolve = (): QueryResult => {
      const r = resultFor(table, record.op);
      return { data: r.data ?? null, error: r.error ?? null };
    };

    const builder: Record<string, unknown> = {};

    const startOp = (op: Op, payload?: unknown) => {
      if (!started) {
        record.op = op;
        record.payload = payload;
        started = true;
        calls.push(record);
      }
      return builder;
    };

    builder.select = vi.fn((..._args: unknown[]) => startOp("select", _args[0]));
    builder.insert = vi.fn((payload: unknown) => startOp("insert", payload));
    builder.update = vi.fn((payload: unknown) => startOp("update", payload));
    builder.delete = vi.fn(() => startOp("delete"));
    const addFilter = (col: string, val: unknown) => {
      record.filters.push({ col, val });
      return builder;
    };
    builder.eq = vi.fn(addFilter);
    builder.neq = vi.fn(addFilter);
    builder.lt = vi.fn(addFilter);
    builder.lte = vi.fn(addFilter);
    builder.gt = vi.fn(addFilter);
    builder.gte = vi.fn(addFilter);
    builder.in = vi.fn(addFilter);
    builder.is = vi.fn(addFilter);
    builder.ilike = vi.fn(addFilter);
    builder.maybeSingle = vi.fn(() => Promise.resolve(resolve()));
    builder.single = vi.fn(() => Promise.resolve(resolve()));
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    builder.range = vi.fn(() => builder);
    // Make the builder awaitable for chains that end without maybeSingle().
    builder.then = (onF: (v: QueryResult) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(resolve()).then(onF, onR);

    return builder;
  });

  return {
    client: {
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user }, error: null })),
      },
      from,
    },
    calls,
    callsFor: (table: string, op?: Op) =>
      calls.filter((c) => c.table === table && (op ? c.op === op : true)),
  };
}
