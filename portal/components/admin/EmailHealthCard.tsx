"use client";

import { useFormState, useFormStatus } from "react-dom";
import { sendTestEmailAction } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";
import type { EmailLogEntry } from "@/lib/email";

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

function SetupSteps({ health }: { health: EmailHealthVM }) {
  return (
    <div className="dashed-panel" style={{ gap: 8 }}>
      <div className="dashed-panel-title">One-time setup (~10 minutes)</div>
      <ol style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
        {!health.configured && (
          <li>
            Create a free account at <strong>resend.com</strong> → API Keys → create a key.
            In Vercel → your portal project → Settings → Environment Variables, add{" "}
            <code>RESEND_API_KEY</code> with that value.
          </li>
        )}
        <li>
          In Resend → <strong>Domains</strong>, add your domain (e.g.{" "}
          <code>trumbullnorth.com</code>) and create the 3 DNS records it shows at your domain
          registrar. Wait for it to say <em>Verified</em> (usually minutes).
        </li>
        <li>
          In Vercel → Environment Variables, add <code>EMAIL_FROM</code> ={" "}
          <code>3331 Trumbull Portal &lt;portal@trumbullnorth.com&gt;</code> (any address at your
          verified domain).
        </li>
        <li>
          <strong>Redeploy</strong> the portal in Vercel (env changes only apply on the next
          deploy), then come back here and hit the test button.
        </li>
      </ol>
    </div>
  );
}

export default function EmailHealthCard({
  health,
  log,
}: {
  health: EmailHealthVM;
  log: EmailLogEntry[];
}) {
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
      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 2px" }}>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
          {!health.configured ? (
            <>
              <strong>No email can be sent right now: RESEND_API_KEY is not set.</strong> The
              portal doesn&apos;t depend on it — every invite shows you a link you can text or
              email yourself, and completed signings appear in the message threads — but invites,
              password resets, welcome emails, and all-documents-signed emails will only send
              automatically once Resend is configured below.
            </>
          ) : health.sandbox ? (
            <>
              Resend is connected but still on its sandbox sender <code>{health.from}</code>,
              which <strong>only delivers to your own Resend account email</strong> — investors
              receive nothing. Finish steps 2–4 below to go live.
            </>
          ) : (
            <>
              Sending as <code>{health.from}</code>. Invites, password resets, welcome, and
              all-documents-signed emails are active. Every attempt is logged below.
            </>
          )}
        </div>

        {(!health.configured || health.sandbox) && <SetupSteps health={health} />}

        <form action={formAction}>
          <TestButton />
        </form>
        {state.error && <div className="error-text">{state.error}</div>}
        {state.ok && state.message && (
          <div style={{ fontSize: 13, color: "var(--gold, #d9a441)", lineHeight: 1.6 }}>
            {state.message}
          </div>
        )}

        <div>
          <div className="dashed-panel-title" style={{ marginBottom: 6 }}>
            Recent email attempts
          </div>
          {log.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--faint)" }}>
              Nothing logged yet — attempts appear here the moment any email is triggered
              (invite, reset, welcome, signing, test).
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {log.slice(0, 12).map((e, i) => (
                <div
                  key={`${e.at}-${i}`}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "baseline",
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ color: e.ok ? "#7fc97f" : "#e07a5f", minWidth: 14 }}>
                    {e.ok ? "✓" : "✕"}
                  </span>
                  <span style={{ color: "var(--faint)", whiteSpace: "nowrap" }}>
                    {new Date(e.at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <span style={{ color: "var(--muted)" }}>{e.to}</span>
                  <span style={{ color: "var(--faint)" }}>{e.subject}</span>
                  {!e.ok && e.error && (
                    <span style={{ color: "#e07a5f", flexBasis: "100%", paddingLeft: 24 }}>
                      {e.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
