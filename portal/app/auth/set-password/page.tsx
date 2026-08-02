import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SetPasswordForm from "@/components/SetPasswordForm";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: { token_hash?: string; type?: string };
}) {
  const tokenHash = searchParams.token_hash;
  const otpType = searchParams.type;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Reachable either with an active session (post-verification) or with an
  // unredeemed invite/recovery token carried over from the emailed link.
  if (!user && !tokenHash) redirect("/");

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-wordmark">3331 Trumbull</div>
          <div className="login-eyebrow">INVESTOR PORTAL</div>
        </div>
        <div className="login-title">Set your password</div>
        <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", lineHeight: 1.6 }}>
          Welcome{user?.email ? `, ${user.email}` : ""}. Choose a password to finish setting up
          your account.
        </div>
        <SetPasswordForm tokenHash={user ? undefined : tokenHash} otpType={otpType} />
      </div>
    </div>
  );
}
