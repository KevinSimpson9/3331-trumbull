import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth";
import SignInForm from "@/components/SignInForm";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  // If Supabase is unreachable (paused project, outage), render the sign-in
  // page as signed-out instead of crashing the route.
  let user = null;
  let isAdmin = false;
  try {
    const supabase = createClient();
    ({
      data: { user },
    } = await supabase.auth.getUser());
    if (user) isAdmin = await isAdminUser(supabase);
  } catch {
    user = null;
  }
  if (user) {
    redirect(isAdmin ? "/admin" : "/room");
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-wordmark">3331 Trumbull</div>
          <div className="login-eyebrow">INVESTOR PORTAL</div>
        </div>
        <div className="login-lock-row">
          <div className="login-lock">
            <svg width="20" height="24" viewBox="0 0 20 24" fill="none" aria-hidden="true">
              <rect x="2" y="10" width="16" height="12" rx="2" stroke="#d9a441" strokeWidth="1.5" />
              <path d="M6 10V7a4 4 0 0 1 8 0v3" stroke="#d9a441" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
        <div className="login-title">Investor sign-in</div>
        <SignInForm />
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 14,
            textAlign: "center",
            fontSize: 12.5,
          }}
        >
          Interested in investing? <Link href="/subscribe">Subscribe →</Link>
        </div>
      </div>
    </div>
  );
}
