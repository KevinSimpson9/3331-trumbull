"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/auth";
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

  // Portal invite email with a set-password link.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  let authUserId: string | null = null;
  let inviteLink: string | undefined;
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/auth/set-password`,
    data: { legal_name: legalName },
  });
  if (inviteError) {
    // Email couldn't be sent (commonly Supabase's hourly email rate limit).
    // Fall back to minting the invite link directly so the admin can deliver
    // it themselves — the investor is still created.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: `${siteUrl}/auth/confirm?next=/auth/set-password`,
        data: { legal_name: legalName },
      },
    });
    if (linkError || !linkData?.properties?.action_link) {
      return { error: `Invite failed: ${inviteError.message}` };
    }
    authUserId = linkData.user?.id ?? null;
    inviteLink = linkData.properties.action_link;
  } else {
    authUserId = invited.user?.id ?? null;
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
      message:
        "Investor created — but the invite email couldn't be sent (email rate limit). Send them this link yourself:",
      inviteLink,
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

  // 'invite' only works before the user accepts; fall back to a magic link
  // for anyone who already has an account.
  const { data: inviteData } = await admin.auth.admin.generateLink({
    type: "invite",
    email: investor.email,
    options: {
      redirectTo: `${siteUrl}/auth/confirm?next=/auth/set-password`,
      data: { legal_name: investor.legal_name },
    },
  });
  let link = inviteData?.properties?.action_link ?? null;

  if (!link) {
    const { data: magicData, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: investor.email,
      options: { redirectTo: `${siteUrl}/auth/confirm?next=/room?sign=loi` },
    });
    if (error || !magicData?.properties?.action_link) {
      return { error: "Couldn't create an invite link — try again." };
    }
    link = magicData.properties.action_link;
  }

  return { ok: true, inviteLink: link };
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
