import { createAdminClient } from "@/lib/supabase/admin";

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

export interface EmailLogEntry {
  at: string; // ISO timestamp
  to: string;
  subject: string;
  ok: boolean;
  error?: string;
}

const LOG_BUCKET = "portal-internal";
const LOG_PATH = "email-log.json";
const LOG_MAX = 50;

/** Every send attempt — success or failure — is recorded here so email
 *  problems are visible in the admin dashboard instead of vanishing.
 *  Storage-backed (bucket auto-created), so no SQL setup is ever needed.
 *  Best-effort: a logging failure never affects the send itself. */
async function appendEmailLog(entry: EmailLogEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.storage.createBucket(LOG_BUCKET, { public: false }).catch(() => {});
    const log = await getEmailLog();
    log.unshift(entry);
    await admin.storage
      .from(LOG_BUCKET)
      .upload(LOG_PATH, JSON.stringify(log.slice(0, LOG_MAX)), {
        contentType: "application/json",
        upsert: true,
      });
  } catch (e) {
    console.error("email log write failed", e);
  }
}

/** Most-recent-first list of email attempts, for the admin dashboard. */
export async function getEmailLog(): Promise<EmailLogEntry[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.storage.from(LOG_BUCKET).download(LOG_PATH);
    if (!data) return [];
    const parsed = JSON.parse(await data.text());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Transactional email via Resend (https://resend.com). Requires
 * RESEND_API_KEY; without it every send fails fast with a clear reason.
 * Every attempt is appended to the storage-backed email log, and failures
 * are also logged to the function console with Resend's actual error, so
 * misconfiguration (unverified domain, sandbox sender) is always visible.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<SendEmailResult> {
  const result = await attemptSend(opts);
  await appendEmailLog({
    at: new Date().toISOString(),
    to: opts.to,
    subject: opts.subject,
    ok: result.ok,
    error: result.error,
  });
  return result;
}

async function attemptSend(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY is not configured in Vercel" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
      }),
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
