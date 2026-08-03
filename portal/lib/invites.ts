import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailConfigured } from "@/lib/email";
import { firstName } from "@/lib/format";

export interface InviteDelivery {
  /** Auth user id for the invited email, or null when the account couldn't be created. */
  authUserId: string | null;
  /** Set when we minted the link ourselves (i.e. Supabase didn't email it). */
  inviteLink: string | null;
  /** True when an email carrying the set-password link actually went out. */
  delivered: boolean;
  /** Why the email didn't go out, when delivered is false (Resend/Supabase reason). */
  deliveryError?: string;
  /** Underlying failure message when the account couldn't be created at all. */
  error?: string;
}

/** The portal's public origin. Prefers NEXT_PUBLIC_SITE_URL; falls back to the
 *  current request's host so emailed links are never relative/broken when the
 *  env var is missing or stale. */
export function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? "https";
      return `${proto}://${host}`;
    }
  } catch {
    // outside a request scope — nothing to fall back to
  }
  return "";
}

/** Self-contained link to our own /auth/confirm route with the token hash —
 *  no dependence on Supabase's redirect allow-list, so it always lands
 *  inside the portal. */
function confirmLink(hashedToken: string, type: "invite" | "recovery", next: string): string {
  return `${siteUrl()}/auth/confirm?token_hash=${hashedToken}&type=${type}&next=${encodeURIComponent(next)}`;
}

/**
 * Create the auth account for an investor and deliver their set-password
 * invite.
 *
 * Resend is the primary channel whenever RESEND_API_KEY is configured: the
 * link is minted with generateLink (no email involved) and sent from our own
 * sender, so Supabase's built-in mailer — which allows only a few emails per
 * hour — is never touched. Without Resend we use Supabase's invite email,
 * and when that's rate-limited we still mint the link so the caller can
 * deliver it by hand. The account is created in every non-error path.
 */
export async function deliverPortalInvite(email: string, legalName: string): Promise<InviteDelivery> {
  const admin = createAdminClient();

  if (emailConfigured()) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: { legal_name: legalName } },
    });
    if (!error && data?.properties?.hashed_token) {
      const link = confirmLink(data.properties.hashed_token, "invite", "/auth/set-password");
      const sent = await sendEmail({
        to: email,
        subject: "3331 Trumbull investor portal — set your password",
        text:
          `${firstName(legalName)},\n\n` +
          `Your private room on the 3331 Trumbull investor portal is ready. ` +
          `Set your password here to get in:\n\n${link}\n\n` +
          `Once you're in, your documents are ready to review and sign right in the portal.\n\n` +
          `Kevin Simpson\nAK Capital Investments\nkevin@akcapital.fund`,
      });
      return {
        authUserId: data.user?.id ?? null,
        inviteLink: link,
        delivered: sent.ok,
        deliveryError: sent.error,
      };
    }
    // generateLink failed (e.g. the auth account already exists) — fall
    // through so Supabase's invite path can report the real error.
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/auth/set-password`,
    data: { legal_name: legalName },
  });
  if (!inviteError) {
    return { authUserId: invited.user?.id ?? null, inviteLink: null, delivered: true };
  }

  // Supabase's mailer refused (commonly its hourly rate limit). Mint the link
  // anyway so the account still exists and the caller can deliver it.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: { legal_name: legalName } },
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    return { authUserId: null, inviteLink: null, delivered: false, error: inviteError.message };
  }
  return {
    authUserId: linkData.user?.id ?? null,
    inviteLink: confirmLink(linkData.properties.hashed_token, "invite", "/auth/set-password"),
    delivered: false,
    deliveryError: inviteError.message,
  };
}

/**
 * Password-reset counterpart: send the recovery link via Resend when
 * configured, falling back to Supabase's mailer. Silently does nothing when
 * no account exists for the email — callers always show a neutral message.
 */
export async function deliverPasswordReset(email: string): Promise<void> {
  const admin = createAdminClient();

  if (emailConfigured()) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (error) return; // no such account — nothing to send
    if (data?.properties?.hashed_token) {
      const link = confirmLink(data.properties.hashed_token, "recovery", "/auth/set-password");
      const sent = await sendEmail({
        to: email,
        subject: "3331 Trumbull investor portal — reset your password",
        text:
          `Reset your 3331 Trumbull portal password here:\n\n${link}\n\n` +
          `If you didn't request this, you can ignore this email.\n\n` +
          `Kevin Simpson\nAK Capital Investments\nkevin@akcapital.fund`,
      });
      if (sent.ok) return;
    }
  }

  await admin.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/auth/set-password`,
  });
}
