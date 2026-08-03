"use server";

import { createAdminClient, ADMIN_EMAIL } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { deliverPortalInvite, siteUrl } from "@/lib/invites";
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

  const base = siteUrl();
  const invite = await deliverPortalInvite(email, legalName);
  if (!invite.authUserId) {
    return {
      error:
        "Something went wrong setting up your account — email kevin@akcapital.fund and we'll set you up directly.",
    };
  }

  const { data: created, error: insertError } = await admin
    .from("investors")
    .insert({
      legal_name: legalName,
      email,
      principal: amount,
      status: "invited",
      auth_user_id: invite.authUserId,
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

  // Email notifications (no-ops until RESEND_API_KEY is configured). The
  // set-password invite itself was already handled by deliverPortalInvite;
  // when it couldn't be emailed, the admin copy carries the link so Kevin can
  // deliver it by hand.
  await Promise.all([
    sendEmail({
      to: ADMIN_EMAIL,
      subject: `New portal subscription — ${legalName} (${fmtMoney(amount)})`,
      text:
        `New subscription on the 3331 Trumbull investor portal:\n\n` +
        `Name: ${legalName}\nEmail: ${email}\nConsidering: ${fmtMoney(amount)}\n` +
        `Method: ${method || "—"}\n\n` +
        (!invite.delivered && invite.inviteLink
          ? `Their invite email couldn't be sent — send them this set-password link ` +
            `yourself:\n${invite.inviteLink}\n\n`
          : "") +
        `Their room is live and the LOI is queued for signature.\nAdmin: ${base}/admin`,
    }),
    sendEmail({
      to: email,
      subject: "3331 Trumbull — your subscription was received",
      text:
        `${firstName(legalName)},\n\n` +
        `Thanks for subscribing to the 3331 Trumbull investor portal. We've recorded your ` +
        `indicative commitment of ${fmtMoney(amount)}.\n\n` +
        `A separate email invites you to set your password. Once you're in, your ` +
        `Non-Binding Letter of Intent is ready to review and sign right in the portal.\n\n` +
        `Kevin Simpson\nAK Capital Investments\nkevin@akcapital.fund`,
    }),
  ]);

  // Even when no invite email could go out (Supabase rate-limited and Resend
  // not configured), the subscription went through — say so instead of
  // dead-ending them. Kevin sees the commitment in the back office and can
  // send the link from the roster's "Copy invite link".
  if (!invite.delivered) {
    return {
      ok: true,
      message:
        "You're subscribed — your room is being set up. We'll email your sign-in link shortly; " +
        "if you don't hear from us within the hour, email kevin@akcapital.fund.",
    };
  }
  return { ok: true, message: "Check your email — your invite is on its way." };
}
