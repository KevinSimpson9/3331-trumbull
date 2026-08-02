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

/**
 * Optional transactional email via Resend (https://resend.com).
 * If RESEND_API_KEY is not set, sends are skipped silently — the portal's
 * auth emails (invites, password resets) still go out via Supabase.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

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
    return res.ok;
  } catch {
    return false;
  }
}
