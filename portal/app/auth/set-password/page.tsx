import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SetPasswordForm from "@/components/SetPasswordForm";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-wordmark">3331 Trumbull</div>
          <div className="login-eyebrow">INVESTOR PORTAL</div>
        </div>
        <div className="login-title">Set your password</div>
        <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", lineHeight: 1.6 }}>
          Welcome{user.email ? `, ${user.email}` : ""}. Choose a password to finish setting up
          your account.
        </div>
        <SetPasswordForm />
      </div>
    </div>
  );
}
