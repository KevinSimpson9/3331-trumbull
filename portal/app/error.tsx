"use client";

/**
 * Route-level error boundary: shown when a server render fails (e.g. the
 * Supabase project is paused or unreachable) instead of Next's raw 500 page.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-wordmark">3331 Trumbull</div>
          <div className="login-eyebrow">INVESTOR PORTAL</div>
        </div>
        <div className="login-title">Temporarily unavailable</div>
        <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.75, textAlign: "center" }}>
          The portal couldn&apos;t load just now. This is usually brief — please try again, or
          reach out to <a href="mailto:kevin@akcapital.fund">kevin@akcapital.fund</a> if it
          persists.
        </p>
        <button type="button" className="btn-gold" onClick={() => reset()} style={{ width: "100%" }}>
          Try again
        </button>
      </div>
    </div>
  );
}
