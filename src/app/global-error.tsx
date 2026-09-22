"use client";

/* Last-resort boundary: fires when the root layout itself throws, so it
   replaces <html>/<body> and cannot rely on globals.css or the font vars.
   Styles are inlined and self-contained. Mulberry accent, human copy. */
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
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#efece6",
          color: "#1e1b17",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          padding: "24px",
        }}
      >
        <div role="alert" style={{ maxWidth: "44ch" }}>
          <p
            style={{
              margin: 0,
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#978f86",
            }}
          >
            Something went wrong
          </p>
          <h1 style={{ margin: "8px 0 0", fontSize: "22px", fontWeight: 600 }}>
            The app needs a restart.
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "14.5px",
              lineHeight: 1.5,
              color: "#6b645c",
            }}
          >
            An unexpected error stopped the page from loading. Reloading usually
            fixes it. If it keeps happening, ask your manager to check the
            connection.
          </p>
          <div style={{ marginTop: "24px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                minHeight: "44px",
                padding: "0 20px",
                borderRadius: "8px",
                border: "none",
                background: "#8e3a4e",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
            <a
              href="/today"
              style={{
                minHeight: "44px",
                display: "inline-flex",
                alignItems: "center",
                padding: "0 20px",
                borderRadius: "8px",
                border: "1px solid #cfc6bb",
                color: "#1e1b17",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Back to dashboard
            </a>
          </div>
          {error.digest && (
            <p style={{ marginTop: "24px", fontSize: "12px", color: "#978f86" }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
