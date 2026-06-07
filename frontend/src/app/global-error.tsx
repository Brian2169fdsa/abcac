"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#f9fafb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "1rem",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "1rem",
            padding: "2.5rem",
            maxWidth: "28rem",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#111827", margin: "0 0 0.75rem" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: "0 0 1.5rem" }}>
            A critical error has occurred. Please reload the page to continue.
          </p>
          {error.digest && (
            <p style={{ fontSize: "0.75rem", color: "#9ca3af", fontFamily: "monospace", margin: "0 0 1.25rem" }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.5rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#ffffff",
              background: "#1d4ed8",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
        </div>
      </body>
    </html>
  );
}
