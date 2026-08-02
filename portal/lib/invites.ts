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
  /** Underlying failure message when the account couldn't be created at all. */
  error?: string;
}

function setPasswordRedirect(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  return `${siteUrl}/auth/confirm?next=/auth/set-password`;
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
  const redirectTo = setPasswordRedirect();

  if (emailConfigured()) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo, data: { legal_name: legalName } },
    });
    const link = data?.properties?.action_link ?? null;
    if (!error && link) {
      const delivered = await sendEmail({
        to: email,
        subject: "3331 Trumbull investor portal — set your password",
        text:
          `${firstName(legalName)},\n\n` +
          `Your private room on the 3331 Trumbull investor portal is ready. ` +
          `Set your password here to get in:\n\n${link}\n\n` +
          `Once you're in, your documents are ready to review and sign right in the portal.\n\n` +
          `Kevin Simpson\nAK Capital Investments\nkevin@akcapital.fund`,
      });
      return { authUserId: data.user?.id ?? null, inviteLink: link, delivered };
    }
    // generateLink failed (e.g. the auth account already exists) — fall
    // through so Supabase's invite path can report the real error.
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
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
    options: { redirectTo, data: { legal_name: legalName } },
  });
  if (linkError || !linkData?.properties?.action_link) {
    return { authUserId: null, inviteLink: null, delivered: false, error: inviteError.message };
  }
  return {
    authUserId: linkData.user?.id ?? null,
    inviteLink: linkData.properties.action_link,
    delivered: false,
  };
}

/**
 * Password-reset counterpart: send the recovery link via Resend when
 * configured, falling back to Supabase's mailer. Silently does nothing when
 * no account exists for the email — callers always show a neutral message.
 */
export async function deliverPasswordReset(email: string): Promise<void> {
  const admin = createAdminClient();
  const redirectTo = setPasswordRedirect();

  if (emailConfigured()) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (error) return; // no such account — nothing to send
    const link = data?.properties?.action_link ?? null;
    if (link) {
      const delivered = await sendEmail({
        to: email,
        subject: "3331 Trumbull investor portal — reset your password",
        text:
          `Reset your 3331 Trumbull portal password here:\n\n${link}\n\n` +
          `If you didn't request this, you can ignore this email.\n\n` +
          `Kevin Simpson\nAK Capital Investments\nkevin@akcapital.fund`,
      });
      if (delivered) return;
    }
  }

  await admin.auth.resetPasswordForEmail(email, { redirectTo });
}
