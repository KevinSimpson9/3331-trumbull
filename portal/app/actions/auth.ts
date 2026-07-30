"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, ADMIN_EMAIL } from "@/lib/supabase/admin";

export interface FormState {
  error?: string;
  ok?: boolean;
  message?: string;
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

  if (email === ADMIN_EMAIL) redirect("/admin");

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

  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  // Ensure the investor row is linked to this auth user (invites are linked at
  // creation; this covers accounts created before the link existed).
  if (user.email && user.email.toLowerCase() !== ADMIN_EMAIL) {
    const admin = createAdminClient();
    await admin
      .from("investors")
      .update({ auth_user_id: user.id })
      .eq("email", user.email.toLowerCase())
      .is("auth_user_id", null);
  }

  redirect(user.email && user.email.toLowerCase() === ADMIN_EMAIL ? "/admin" : "/room");
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
