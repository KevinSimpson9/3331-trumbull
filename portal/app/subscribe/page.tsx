import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SubscribeForm from "@/components/SubscribeForm";

export const dynamic = "force-dynamic";

export default async function SubscribePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/room");

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-wordmark">3331 Trumbull</div>
          <div className="login-eyebrow">INVESTOR PORTAL</div>
        </div>
        <div className="login-title">Subscribe to invest</div>
        <div style={{ fontSize: 13.5, color: "var(--muted)", textAlign: "center", lineHeight: 1.65 }}>
          Tell us who you are and the commitment you&apos;re considering. You&apos;ll get your own
          private room with the commitment letter ready to sign.
        </div>
        <SubscribeForm />
        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 14,
            textAlign: "center",
            fontSize: 12.5,
          }}
        >
          Already have access? <Link href="/">Sign in →</Link>
        </div>
      </div>
    </div>
  );
}
