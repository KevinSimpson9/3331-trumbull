/** True when Resend is configured and sendEmail() can actually deliver. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** The From address used for portal emails. */
export function emailFrom(): string {
  return process.env.EMAIL_FROM || "3331 Trumbull Portal <onboarding@resend.dev>";
}

/** True while still on Resend's sandbox sender, which only delivers to the
 *  Resend account owner's own email — real investors receive nothing. */
export function usingSandboxSender(): boolean {
  return emailFrom().includes("onboarding@resend.dev");
}

export interface SendEmailResult {
  ok: boolean;
  /** Human-readable failure reason (Resend error message, network error, or
   *  missing configuration) — surfaced to the admin UI where useful. */
  error?: string;
}

/**
 * Optional transactional email via Resend (https://resend.com).
 * If RESEND_API_KEY is not set, sends are skipped — the portal's
 * auth emails (invites, password resets) still go out via Supabase.
 * Failures are logged with Resend's actual error so misconfiguration
 * (unverified domain, sandbox sender) is visible instead of silent.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY is not configured" };

  const from = emailFrom();
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, text: opts.text }),
    });
    if (res.ok) return { ok: true };

    const body = await res.text().catch(() => "");
    let reason = `Resend rejected the email (HTTP ${res.status})`;
    try {
      const parsed = JSON.parse(body);
      if (parsed?.message) reason = parsed.message;
    } catch {
      // non-JSON error body — keep the status-based reason
    }
    console.error(`sendEmail to ${opts.to} failed: ${res.status} ${body}`);
    return { ok: false, error: reason };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "network error";
    console.error(`sendEmail to ${opts.to} failed:`, e);
    return { ok: false, error: reason };
  }
}
