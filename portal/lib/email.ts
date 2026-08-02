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
