"use server";

import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/auth";

export interface FormState {
  error?: string;
  ok?: boolean;
  message?: string;
  /** Manual invite link, set when the invite email couldn't be sent
   *  (e.g. Supabase email rate limit) so the admin can deliver it directly. */
  inviteLink?: string;
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Incorrect email or password. First time? Use the link in your invitation email." };
  }

  if (await isAdminUser(supabase)) redirect("/admin");

  const { data: investor } = await supabase
    .from("investors")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!investor) {
    await supabase.auth.signOut();
    return { error: "No investor account found for that email. Contact kevin@akcapital.fund." };
  }

  redirect("/room");
}

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function setPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  const tokenHash = String(formData.get("token_hash") || "");
  const otpType = String(formData.get("otp_type") || "");

  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  const supabase = createClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();

  // First submit from an emailed invite/reset link: redeem the one-time token
  // now — only after the password fields validate, so a typo can't waste it.
  // Once verified there's a session, so any retry goes through the session path.
  if (!user && tokenHash && otpType) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: otpType as EmailOtpType,
      token_hash: tokenHash,
    });
    if (error) {
      return {
        error:
          "This link has expired or was already used. Use “Forgot password?” on the sign-in page to get a fresh one, or contact kevin@akcapital.fund.",
      };
    }
    user = data.user;
  }
  if (!user) redirect("/");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  // Ensure the investor row is linked to this auth user (invites are linked at
  // creation; this covers accounts created before the link existed). No-op for
  // the admin — no investor row carries that email.
  if (user.email) {
    const admin = createAdminClient();
    await admin
      .from("investors")
      .update({ auth_user_id: user.id })
      .eq("email", user.email.toLowerCase())
      .is("auth_user_id", null);
  }

  // New investors land directly in the LOI signing flow.
  redirect((await isAdminUser(supabase)) ? "/admin" : "/room?sign=loi");
}

export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) return { error: "Enter your email address." };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const supabase = createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/auth/set-password`,
  });

  // Always report success — don't reveal which emails exist.
  return { ok: true, message: "If that email is on the roster, a reset link is on its way." };
}
