/** Whether the portal can send its own email (Resend configured). */
export function canSendEmail(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Invite email body carrying the self-contained set-password link. */
export function inviteEmailText(name: string, inviteLink: string): string {
  return (
    `${name},\n\n` +
    `You've been invited to the 3331 Trumbull investor portal.\n\n` +
    `Set your password and enter your room here:\n${inviteLink}\n\n` +
    `Once you're in, your documents are ready to review and sign.\n\n` +
    `Kevin Simpson\nAK Capital Investments\nkevin@akcapital.fund`
  );
}

export interface EmailResult {
  ok: boolean;
  /** Why the send failed — surfaced to the admin so delivery problems
   *  (missing key, unverified from-domain, etc.) are visible, not silent. */
  error?: string;
}

/**
 * Transactional email via Resend (https://resend.com).
 * If RESEND_API_KEY is not set, invites fall back to Supabase's auth emails.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY is not configured" };

  const from = process.env.EMAIL_FROM || "3331 Trumbull Portal <onboarding@resend.dev>";
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
    let detail = "";
    try {
      detail = ((await res.json()) as { message?: string })?.message || "";
    } catch {
      // Non-JSON error body — the status code alone will have to do.
    }
    console.error(`Resend send to ${opts.to} failed: ${res.status} ${detail}`);
    return { ok: false, error: detail || `Resend returned ${res.status}` };
  } catch (e) {
    console.error(`Resend send to ${opts.to} failed:`, e);
    return { ok: false, error: "Network error reaching Resend" };
  }
}
