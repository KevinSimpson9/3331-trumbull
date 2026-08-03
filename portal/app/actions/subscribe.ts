"use server";

import { createAdminClient, ADMIN_EMAIL } from "@/lib/supabase/admin";
import { sendEmail, canSendEmail } from "@/lib/email";
import { firstName, fmtMoney } from "@/lib/format";
import type { FormState } from "./auth";

const METHODS = [
  "Cash / personal funds",
  "Self-directed IRA / 401(k)",
  "Entity (LLC, trust, etc.)",
  "1031 exchange / other",
  "Not sure yet",
];

/**
 * Public self-service subscription: creates the investor record, sends the
 * portal invite (set-password link), notifies the admin, and seeds the
 * investor's thread so the commitment shows up in the back office.
 */
export async function subscribeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const legalName = String(formData.get("legalName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const amountRaw = String(formData.get("amount") || "").replace(/[^0-9.]/g, "");
  const amount = Number(amountRaw);
  const method = String(formData.get("method") || "").trim();

  if (!legalName || !email) return { error: "Your full legal name and email are required." };
  if (!amount || amount <= 0) return { error: "Enter the amount you're considering committing." };
  if (method && !METHODS.includes(method)) return { error: "Choose an investment method from the list." };

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("investors")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return { error: "That email already has a portal account — sign in above, or use Forgot password." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  let authUserId: string | null = null;
  let inviteLink: string | undefined;

  if (canSendEmail()) {
    // Mint the set-password link ourselves and email it in the confirmation
    // below. The token is redeemed only when they submit their password, so
    // the link survives email scanners and works on the first real click.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: { legal_name: legalName } },
    });
    if (linkError || !linkData?.properties?.hashed_token) {
      return { error: "Something went wrong creating your account — email kevin@akcapital.fund." };
    }
    authUserId = linkData.user?.id ?? null;
    inviteLink = `${siteUrl}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=invite&next=/auth/set-password`;
  } else {
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/confirm?next=/auth/set-password`,
      data: { legal_name: legalName },
    });
    if (inviteError) {
      return {
        error: /rate limit/i.test(inviteError.message)
          ? "Our invite emails are briefly rate-limited — please try again in about an hour, or email kevin@akcapital.fund and we'll set you up directly."
          : `Could not send your invite: ${inviteError.message}`,
      };
    }
    authUserId = invited.user?.id ?? null;
  }

  const { data: created, error: insertError } = await admin
    .from("investors")
    .insert({
      legal_name: legalName,
      email,
      principal: amount,
      status: "invited",
      auth_user_id: authUserId,
    })
    .select("id")
    .single();
  if (insertError || !created) {
    return { error: "Something went wrong creating your account — email kevin@akcapital.fund." };
  }

  // Surface the commitment inside the back office thread (reads as from the
  // investor so the admin gets the gold unread dot).
  await admin.from("messages").insert([
    {
      investor_id: created.id,
      sender: "investor",
      body: `Subscribed via the portal — considering ${fmtMoney(amount)}${method ? ` · ${method}` : ""}.`,
    },
    {
      investor_id: created.id,
      sender: "admin",
      body: `${firstName(legalName)}, welcome to the 3331 Trumbull portal. Your commitment letter is ready to review and sign — I'll follow up shortly.`,
    },
  ]);

  // Email notifications (no-ops until RESEND_API_KEY is configured).
  const [, subscriberEmail] = await Promise.all([
    sendEmail({
      to: ADMIN_EMAIL,
      subject: `New portal subscription — ${legalName} (${fmtMoney(amount)})`,
      text:
        `New subscription on the 3331 Trumbull investor portal:\n\n` +
        `Name: ${legalName}\nEmail: ${email}\nConsidering: ${fmtMoney(amount)}\n` +
        `Method: ${method || "—"}\n\n` +
        `Their room is live and the LOI is queued for signature.\nAdmin: ${siteUrl}/admin`,
    }),
    sendEmail({
      to: email,
      subject: "3331 Trumbull — your subscription was received",
      text:
        `${firstName(legalName)},\n\n` +
        `Thanks for subscribing to the 3331 Trumbull investor portal. We've recorded your ` +
        `indicative commitment of ${fmtMoney(amount)}.\n\n` +
        (inviteLink
          ? `Set your password and enter your room here:\n${inviteLink}\n\nOnce you're in, your `
          : `A separate email invites you to set your password. Once you're in, your `) +
        `Non-Binding Letter of Intent is ready to review and sign right in the portal.\n\n` +
        `Kevin Simpson\nAK Capital Investments\nkevin@akcapital.fund`,
    }),
  ]);

  // If the Resend email carrying their set-password link didn't go out,
  // fall back to Supabase's invite email so they still get a way in
  // (re-inviting the just-created unconfirmed user re-sends the invite).
  if (inviteLink && !subscriberEmail.ok) {
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/confirm?next=/auth/set-password`,
      data: { legal_name: legalName },
    });
    if (inviteError) {
      return {
        error:
          "Your account was created but the invite email couldn't be sent — email kevin@akcapital.fund and we'll get you set up.",
      };
    }
  }

  return { ok: true, message: "Check your email — your invite is on its way." };
}
