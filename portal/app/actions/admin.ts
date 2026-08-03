"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/auth";
import { sendEmail, canSendEmail, inviteEmailText } from "@/lib/email";
import { firstName } from "@/lib/format";
import type { FormState } from "./auth";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(supabase))) {
    throw new Error("Not authorized");
  }
  return user;
}

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/room");
}

export async function createInvestorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const legalName = String(formData.get("legalName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const principal = Number(formData.get("principal"));
  const rate = Number(formData.get("rate")) || 20;
  const term = Number(formData.get("term")) || 20;

  if (!legalName || !email || !principal) {
    return { error: "Name, email, and principal are required" };
  }

  const admin = createAdminClient();

  // An invite email must go out on every path. With Resend configured the
  // portal sends it itself: we mint the set-password link (token redeemed only
  // when the investor submits their password — immune to email scanners and
  // to Supabase's redirect/PKCE hop) and email it directly, with the same link
  // returned to the admin as a text-able backup. Without Resend, Supabase's
  // own invite email is the sender.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  let authUserId: string | null = null;
  let inviteLink: string | undefined;
  let emailSent = false;
  let emailFailure = "";

  if (canSendEmail()) {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: { legal_name: legalName } },
    });
    if (linkError || !linkData?.properties?.hashed_token) {
      return { error: `Invite failed: ${linkError?.message ?? "couldn't create the invite link"}` };
    }
    authUserId = linkData.user?.id ?? null;
    inviteLink = `${siteUrl}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=invite&next=/auth/set-password`;
    const sent = await sendEmail({
      to: email,
      subject: "Your 3331 Trumbull investor portal invitation",
      text: inviteEmailText(firstName(legalName), inviteLink),
    });
    emailSent = sent.ok;
    if (!sent.ok) {
      emailFailure = sent.error ?? "";
      // Resend refused (e.g. unverified from-domain) — try Supabase's invite
      // email so something still lands in their inbox. Re-inviting the
      // just-created unconfirmed user re-sends their invite.
      const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${siteUrl}/auth/confirm?next=/auth/set-password`,
        data: { legal_name: legalName },
      });
      if (!inviteError) {
        emailSent = true;
        emailFailure = "";
      }
    }
  } else {
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/confirm?next=/auth/set-password`,
      data: { legal_name: legalName },
    });
    if (inviteError) {
      // Commonly Supabase's built-in email rate limit — mint the link so the
      // admin can deliver it themselves; the investor is still created.
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { data: { legal_name: legalName } },
      });
      if (linkError || !linkData?.properties?.hashed_token) {
        return { error: `Invite failed: ${inviteError.message}` };
      }
      authUserId = linkData.user?.id ?? null;
      inviteLink = `${siteUrl}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=invite&next=/auth/set-password`;
      emailFailure = inviteError.message;
    } else {
      authUserId = invited.user?.id ?? null;
      emailSent = true;
    }
  }

  const { error: insertError } = await admin.from("investors").insert({
    legal_name: legalName,
    email,
    principal,
    rate,
    term_months: term,
    status: "invited",
    auth_user_id: authUserId,
  });
  if (insertError) {
    return {
      error:
        insertError.code === "23505"
          ? "An investor with that email already exists."
          : `Could not create investor: ${insertError.message}`,
    };
  }

  const { data: created } = await admin
    .from("investors")
    .select("id")
    .eq("email", email)
    .single();
  if (created) {
    await admin.from("messages").insert({
      investor_id: created.id,
      sender: "admin",
      body: `${firstName(legalName)}, welcome to the 3331 Trumbull portal. Your documents are ready to review and sign.`,
    });
  }

  revalidateAdmin();
  if (inviteLink) {
    return {
      ok: true,
      message: emailSent
        ? "Invite email sent ✓ — you can also copy this same link and text it to them:"
        : `Investor created — the invite email couldn't be sent${
            emailFailure ? ` (${emailFailure})` : ""
          }, so send them this link yourself:`,
      inviteLink,
    };
  }
  return { ok: true, message: "Investor created — invite sent ✓" };
}

/** Mint a fresh set-password link. Targets our own /auth/confirm with the
 *  token hash — no dependence on Supabase's redirect allow-list, and the token
 *  isn't redeemed until the investor submits their password, so the link
 *  survives email scanners and always works on the first real click.
 *  'invite' only works before the user accepts; for anyone who already has an
 *  account, a recovery link lands them on the same set-password screen. */
async function mintSetPasswordLink(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  legalName?: string
): Promise<string | null> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  const { data: inviteData } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: legalName ? { data: { legal_name: legalName } } : undefined,
  });
  if (inviteData?.properties?.hashed_token) {
    return `${siteUrl}/auth/confirm?token_hash=${inviteData.properties.hashed_token}&type=invite&next=/auth/set-password`;
  }

  const { data: recoveryData } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (recoveryData?.properties?.hashed_token) {
    return `${siteUrl}/auth/confirm?token_hash=${recoveryData.properties.hashed_token}&type=recovery&next=/auth/set-password`;
  }
  return null;
}

/** Mint a fresh sign-in link for an investor so the admin can deliver it by
 *  any channel (text, email) — works whether or not they've accepted the
 *  original invite, and regardless of email rate limits. */
export async function getInviteLinkAction(investorId: string): Promise<FormState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: investor } = await admin
    .from("investors")
    .select("email, legal_name")
    .eq("id", investorId)
    .maybeSingle();
  if (!investor) return { error: "Investor not found" };

  const inviteLink = await mintSetPasswordLink(admin, investor.email, investor.legal_name);
  if (!inviteLink) return { error: "Couldn't create an invite link — try again." };
  return { ok: true, inviteLink };
}

/** (Re)send the invite email to an investor with a fresh set-password link,
 *  reporting exactly whether the email went out. */
export async function emailInviteAction(investorId: string): Promise<FormState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: investor } = await admin
    .from("investors")
    .select("email, legal_name")
    .eq("id", investorId)
    .maybeSingle();
  if (!investor) return { error: "Investor not found" };

  const inviteLink = await mintSetPasswordLink(admin, investor.email, investor.legal_name);
  if (!inviteLink) return { error: "Couldn't create an invite link — try again." };

  if (canSendEmail()) {
    const sent = await sendEmail({
      to: investor.email,
      subject: "Your 3331 Trumbull investor portal invitation",
      text: inviteEmailText(firstName(investor.legal_name), inviteLink),
    });
    if (sent.ok) return { ok: true, message: `Invite email sent to ${investor.email} ✓` };
    return {
      error: `Email failed${sent.error ? ` (${sent.error})` : ""} — copy the invite link instead.`,
    };
  }

  // No Resend — Supabase's invite email only works before the user accepts,
  // so try it, then report honestly.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(investor.email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/auth/set-password`,
    data: { legal_name: investor.legal_name },
  });
  if (!inviteError) return { ok: true, message: `Invite email sent to ${investor.email} ✓` };
  return {
    error: `Email failed (${inviteError.message}) — copy the invite link instead.`,
  };
}

/** Admin-only edit of an investor's terms (name, principal, rate, term).
 *  Changes flow into all still-unsigned documents; executed PDFs are
 *  immutable records of what was signed. */
export async function updateInvestorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const investorId = String(formData.get("investorId") || "");
  const legalName = String(formData.get("legalName") || "").trim();
  const principal = Number(formData.get("principal"));
  const rate = Number(formData.get("rate"));
  const term = Number(formData.get("term"));

  if (!investorId) return { error: "Missing investor." };
  if (!legalName) return { error: "Legal name is required." };
  if (!principal || principal <= 0) return { error: "Principal must be a positive amount." };
  if (!rate || rate <= 0) return { error: "Rate must be a positive percentage." };
  if (!term || term <= 0) return { error: "Term must be a positive number of months." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("investors")
    .update({ legal_name: legalName, principal, rate, term_months: term })
    .eq("id", investorId);
  if (error) return { error: `Update failed: ${error.message}` };

  revalidateAdmin();
  revalidatePath(`/admin/investor/${investorId}`);
  return { ok: true, message: "Investor updated ✓" };
}

export async function removeInvestorAction(investorId: string): Promise<FormState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: investor } = await admin
    .from("investors")
    .select("auth_user_id")
    .eq("id", investorId)
    .maybeSingle();

  await admin.from("investors").delete().eq("id", investorId);
  if (investor?.auth_user_id) {
    await admin.auth.admin.deleteUser(investor.auth_user_id);
  }

  revalidateAdmin();
  return { ok: true, message: "Investor removed" };
}

export async function adminSendMessage(investorId: string, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const body = String(formData.get("body") || "").trim();
  if (!body) return {};

  const admin = createAdminClient();
  const { error } = await admin
    .from("messages")
    .insert({ investor_id: investorId, sender: "admin", body });
  if (error) return { error: "Message failed to send — try again." };

  revalidateAdmin();
  revalidatePath(`/admin/investor/${investorId}`);
  return { ok: true };
}

export async function broadcastAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const body = String(formData.get("body") || "").trim();
  if (!body) return { error: "Write an update first." };

  const admin = createAdminClient();
  const { data: investors } = await admin.from("investors").select("id");
  const rows = (investors ?? []).map((i) => ({
    investor_id: i.id,
    sender: "admin" as const,
    body,
  }));
  if (rows.length) {
    const { error } = await admin.from("messages").insert(rows);
    if (error) return { error: "Broadcast failed — try again." };
  }

  revalidateAdmin();
  return { ok: true, message: `Sent to ${rows.length} investors ✓` };
}

export async function markThreadRead(investorId: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  await admin
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("investor_id", investorId)
    .eq("sender", "investor")
    .is("read_at", null);
  revalidatePath("/admin");
}
