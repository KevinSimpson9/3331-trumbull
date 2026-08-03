import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { confirmLinkAction, resendPortalLinkAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

/**
 * Landing page for portal email links (invites, password resets, magic links).
 *
 * Deliberately a page with a button rather than a route that verifies on GET:
 * the token in the link is single-use, and email security scanners
 * (Gmail/Outlook link prefetch) GET every link in an email before the
 * recipient ever clicks. Verifying on GET let scanners burn the token, so the
 * real click failed and bounced investors to the sign-in screen instead of
 * the set-password screen. The token is only consumed when the button below
 * is pressed (a POST, which scanners don't do).
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: {
    token_hash?: string;
    type?: string;
    code?: string;
    next?: string;
    error?: string;
    sent?: string;
  };
}) {
  const tokenHash = searchParams.token_hash ?? "";
  const type = searchParams.type ?? "";
  const code = searchParams.code ?? "";
  const next = searchParams.next ?? "/auth/set-password";
  const hasToken = Boolean((tokenHash && type) || code);

  // Already signed in and the link carries no token — nothing to consume,
  // carry straight on. When the link DOES carry a token, always show the
  // continue button instead: verifying the token signs the browser in as the
  // link's owner, replacing any existing session. Skipping that step here
  // used to hijack invite links opened in an already-signed-in browser (e.g.
  // the admin testing an investor's link) into the wrong account.
  if (!hasToken && !searchParams.error && !searchParams.sent) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/auth/set-password");
  }

  const isRecovery = type === "recovery";

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-wordmark">3331 Trumbull</div>
          <div className="login-eyebrow">INVESTOR PORTAL</div>
        </div>

        {searchParams.sent ? (
          <>
            <div className="login-title">Check your email</div>
            <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", lineHeight: 1.6 }}>
              If that email is on the roster, a fresh sign-in link is on its way. It's valid for a
              limited time — open it as soon as it arrives.
            </div>
          </>
        ) : hasToken && !searchParams.error ? (
          <>
            <div className="login-title">
              {isRecovery ? "Reset your password" : "You're invited"}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", lineHeight: 1.6 }}>
              {isRecovery
                ? "Continue below to choose a new password for your portal account."
                : "Your private room on the 3331 Trumbull investor portal is ready. Continue below to create your password."}
            </div>
            <form action={confirmLinkAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input type="hidden" name="tokenHash" value={tokenHash} />
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="code" value={code} />
              <input type="hidden" name="next" value={next} />
              <button type="submit" className="btn-gold">
                {isRecovery ? "Continue → reset password" : "Continue → create my password"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="login-title">This link has expired</div>
            <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", lineHeight: 1.6 }}>
              Sign-in links are single-use and expire for security. Enter your email and we'll send
              you a fresh one right away.
            </div>
            <form action={resendPortalLinkAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label className="label" htmlFor="email">
                  EMAIL ADDRESS
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <button type="submit" className="btn-gold">
                Email me a fresh link
              </button>
            </form>
          </>
        )}

        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 14,
            textAlign: "center",
            fontSize: 12.5,
          }}
        >
          Trouble getting in? Email{" "}
          <a href="mailto:kevin@akcapital.fund">kevin@akcapital.fund</a>
        </div>
      </div>
    </div>
  );
}
