import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing route for auth links (invites, password resets, magic links).
 *
 * Invite/recovery tokens (?token_hash=) are one-time use, and email security
 * scanners (Outlook SafeLinks, Gmail preview) prefetch links before the
 * recipient ever clicks — so verifying them here on GET would burn the token
 * and dead-end the real user. Instead we carry the token to the set-password
 * screen, where it's redeemed only when they submit their new password.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/auth/set-password";

  if (tokenHash && type) {
    if (type === "magiclink") {
      // Magic links sign straight in — there's no later form submit to defer to.
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) return NextResponse.redirect(new URL(next, request.url));
      return NextResponse.redirect(new URL("/?error=link", request.url));
    }
    const dest = new URL("/auth/set-password", request.url);
    dest.searchParams.set("token_hash", tokenHash);
    dest.searchParams.set("type", type);
    return NextResponse.redirect(dest);
  }

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL("/?error=link", request.url));
}
