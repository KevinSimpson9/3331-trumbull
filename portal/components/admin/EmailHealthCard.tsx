"use client";

import { useFormState, useFormStatus } from "react-dom";
import { sendTestEmailAction } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";

export interface EmailHealthVM {
  /** RESEND_API_KEY is present. */
  configured: boolean;
  /** The From address portal emails use. */
  from: string;
  /** Still on Resend's sandbox sender (delivers only to the account owner). */
  sandbox: boolean;
  adminEmail: string;
}

function TestButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold btn-gold-sm" disabled={pending}>
      {pending ? "Sending…" : "Send me a test email"}
    </button>
  );
}

export default function EmailHealthCard({ health }: { health: EmailHealthVM }) {
  const [state, formAction] = useFormState<FormState, FormData>(sendTestEmailAction, {});

  const statusChip = !health.configured ? (
    <span className="status-chip invited">Not configured</span>
  ) : health.sandbox ? (
    <span className="status-chip invited">Sandbox sender</span>
  ) : (
    <span className="status-chip active">● Configured</span>
  );

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <div className="admin-card-title">Email delivery</div>
        {statusChip}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 2px" }}>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
          {!health.configured ? (
            <>
              <strong>RESEND_API_KEY is not set</strong>, so notification emails — welcome,
              all-documents-signed, subscription alerts — are not being sent. Invite and
              password-reset emails still go out through Supabase&apos;s limited mailer. Add a free
              Resend API key in Vercel and redeploy to turn notifications on.
            </>
          ) : health.sandbox ? (
            <>
              Sending as <code>{health.from}</code> — Resend&apos;s sandbox sender, which{" "}
              <strong>only delivers to your own Resend account email</strong>. Investors receive
              nothing. Verify your domain in Resend → Domains, then set <code>EMAIL_FROM</code> in
              Vercel (e.g. <code>3331 Trumbull Portal &lt;portal@trumbullnorth.com&gt;</code>).
            </>
          ) : (
            <>
              Sending as <code>{health.from}</code>. Welcome, all-documents-signed, and
              subscription emails are active. Use the test button anytime to confirm delivery
              end-to-end.
            </>
          )}
        </div>
        <form action={formAction}>
          <TestButton />
        </form>
        {state.error && <div className="error-text">{state.error}</div>}
        {state.ok && state.message && (
          <div style={{ fontSize: 13, color: "var(--gold, #d9a441)", lineHeight: 1.6 }}>
            {state.message}
          </div>
        )}
      </div>
    </div>
  );
}
