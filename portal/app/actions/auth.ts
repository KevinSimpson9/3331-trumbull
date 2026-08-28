"use server";

import { redirect } from "next/navigation";
import { isAuthRetryableFetchError, type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverPasswordReset, siteUrl } from "@/lib/invites";
import { sendEmail } from "@/lib/email";
import { isAdminUser } from "@/lib/auth";
import { firstName } from "@/lib/format";

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
  // redirect() works by throwing, so it must stay outside the try blocks that
  // guard against Supabase being unreachable (paused project, outage).
  let isAdmin = false;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // A network/availability failure (e.g. paused Supabase project) is not
      // the visitor's fault — don't report it as bad credentials.
      if (isAuthRetryableFetchError(error)) {
        return {
          error:
            "The portal can't reach its data service right now. Please try again in a few minutes, or contact kevin@akcapital.fund.",
        };
      }
      return { error: "Incorrect email or password. First time? Use the link in your invitation email." };
    }

    isAdmin = await isAdminUser(supabase);
    if (!isAdmin) {
      const { data: investor } = await supabase
        .from("investors")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (!investor) {
        await supabase.auth.signOut();
        return { error: "No investor account found for that email. Contact kevin@akcapital.fund." };
      }
    }
  } catch {
    return {
      error:
        "The portal can't reach its data service right now. Please try again in a few minutes, or contact kevin@akcapital.fund.",
    };
  }

  redirect(isAdmin ? "/admin" : "/room");
}

const OTP_TYPES: EmailOtpType[] = ["invite", "magiclink", "recovery", "signup", "email_change", "email"];

/** Only ever redirect to a same-site path. */
function safeNext(raw: string): string {
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/auth/set-password";
}

/**
 * Consumes the single-use token from an emailed portal link and signs the
 * visitor in. Triggered by the button on /auth/confirm — a POST, so email
 * link scanners that prefetch the URL can't burn the token first.
 */
export async function confirmLinkAction(formData: FormData): Promise<void> {
  const tokenHash = String(formData.get("tokenHash") || "");
  const typeRaw = String(formData.get("type") || "") as EmailOtpType;
  const code = String(formData.get("code") || "");
  const next = safeNext(String(formData.get("next") || ""));

  const supabase = createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
  } else if (tokenHash && OTP_TYPES.includes(typeRaw)) {
    const { error } = await supabase.auth.verifyOtp({ type: typeRaw, token_hash: tokenHash });
    if (!error) redirect(next);
  }

  // Verification failed — but if a session already exists (e.g. the link was
  // used once in this browser already), let them through anyway.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next);

  redirect("/auth/confirm?error=expired");
}

/** Self-service recovery from an expired/used link: emails a fresh
 *  set-password link. Neutral outcome either way — never reveals whether an
 *  account exists. */
export async function resendPortalLinkAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (email) await deliverPasswordReset(email);
  redirect("/auth/confirm?sent=1");
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
  // creation; this covers accounts created before the link existed). No-op for
  // the admin — no investor row carries that email.
  const isAdmin = await isAdminUser(supabase);
  if (user.email && !isAdmin) {
    const admin = createAdminClient();
    await admin
      .from("investors")
      .update({ auth_user_id: user.id })
      .eq("email", user.email.toLowerCase())
      .is("auth_user_id", null);

    // Welcome email once the account is fully set up. Best-effort — a mail
    // failure never blocks entry into the room.
    try {
      const { data: inv } = await admin
        .from("investors")
        .select("legal_name")
        .eq("email", user.email.toLowerCase())
        .maybeSingle();
      const greeting = inv?.legal_name ? `${firstName(inv.legal_name)},` : "Welcome,";
      await sendEmail({
        to: user.email,
        subject: "Welcome to the 3331 Trumbull investor portal",
        text:
          `${greeting}\n\n` +
          `Your account is all set — welcome to the 3331 Trumbull investor portal.\n\n` +
          `Your private room has your position details, your documents ready to review and ` +
          `sign, the shared project library, and a direct message line to me.\n\n` +
          `Sign in anytime: ${siteUrl()}\n\n` +
          `Kevin Simpson\nAK Capital Investments\nkevin@akcapital.fund`,
      });
    } catch (e) {
      console.error("welcome email failed", e);
    }
  }

  // New investors land directly in the LOI signing flow.
  redirect(isAdmin ? "/admin" : "/room?sign=loi");
}

export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) return { error: "Enter your email address." };

  // Resend-first so resets aren't subject to Supabase's mailer rate limit.
  await deliverPasswordReset(email);

  // Always report success — don't reveal which emails exist.
  return { ok: true, message: "If that email is on the roster, a reset link is on its way." };
}
