/** True when Resend is configured and sendEmail() can actually deliver. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
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
  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY is not set — skipping send to ${opts.to} (“${opts.subject}”)`
    );
    return false;
  }

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
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[email] Resend rejected send to ${opts.to} (“${opts.subject}”): HTTP ${res.status} ${body}`
      );
    }
    return res.ok;
  } catch (err) {
    console.error(`[email] Resend request failed for ${opts.to} (“${opts.subject}”):`, err);
    return false;
  }
}
