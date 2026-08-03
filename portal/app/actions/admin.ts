"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverPortalInvite } from "@/lib/invites";
import { isAdminUser } from "@/lib/auth";
import { firstName } from "@/lib/format";
import { PAYMENT_SCHEDULE_KEYS } from "@/lib/docs";
import type { PaymentSchedule } from "@/lib/types";
import type { FormState } from "./auth";

function parsePaymentSchedule(formData: FormData): PaymentSchedule {
  const raw = String(formData.get("paymentSchedule") || "") as PaymentSchedule;
  return PAYMENT_SCHEDULE_KEYS.includes(raw) ? raw : "quarterly";
}

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
  const paymentSchedule = parsePaymentSchedule(formData);

  if (!legalName || !email || !principal) {
    return { error: "Name, email, and principal are required" };
  }

  const admin = createAdminClient();

  // Portal invite with a set-password link — Resend-first, Supabase mailer as
  // backup, manual link as last resort (see lib/invites.ts). Links target our
  // own /auth/confirm with the token hash, avoiding Supabase's redirect hop.
  const invite = await deliverPortalInvite(email, legalName);
  if (!invite.authUserId) {
    return { error: `Invite failed: ${invite.error ?? "could not create the account"}` };
  }

  const { error: insertError } = await admin.from("investors").insert({
    legal_name: legalName,
    email,
    principal,
    rate,
    term_months: term,
    payment_schedule: paymentSchedule,
    status: "invited",
    auth_user_id: invite.authUserId,
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
  if (!invite.delivered && invite.inviteLink) {
    return {
      ok: true,
      message:
        "Investor created — but the invite email couldn't be sent (email rate limit). Send them this link yourself:",
      inviteLink: invite.inviteLink,
    };
  }
  return { ok: true, message: "Investor created — invite sent ✓" };
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  // Links target our own /auth/confirm with the token hash — no dependence on
  // Supabase's redirect allow-list, so they always land inside the portal.
  // 'invite' only works before the user accepts; fall back to a magic link
  // for anyone who already has an account.
  const { data: inviteData } = await admin.auth.admin.generateLink({
    type: "invite",
    email: investor.email,
    options: { data: { legal_name: investor.legal_name } },
  });
  if (inviteData?.properties?.hashed_token) {
    return {
      ok: true,
      inviteLink: `${siteUrl}/auth/confirm?token_hash=${inviteData.properties.hashed_token}&type=invite&next=/auth/set-password`,
    };
  }

  const { data: magicData, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: investor.email,
  });
  if (error || !magicData?.properties?.hashed_token) {
    return { error: "Couldn't create an invite link — try again." };
  }
  return {
    ok: true,
    inviteLink: `${siteUrl}/auth/confirm?token_hash=${magicData.properties.hashed_token}&type=magiclink&next=${encodeURIComponent("/room?sign=loi")}`,
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
  const paymentSchedule = parsePaymentSchedule(formData);

  if (!investorId) return { error: "Missing investor." };
  if (!legalName) return { error: "Legal name is required." };
  if (!principal || principal <= 0) return { error: "Principal must be a positive amount." };
  if (!rate || rate <= 0) return { error: "Rate must be a positive percentage." };
  if (!term || term <= 0) return { error: "Term must be a positive number of months." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("investors")
    .update({ legal_name: legalName, principal, rate, term_months: term, payment_schedule: paymentSchedule })
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
