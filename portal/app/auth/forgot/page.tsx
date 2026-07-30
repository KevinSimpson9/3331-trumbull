import Link from "next/link";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-wordmark">3331 Trumbull</div>
          <div className="login-eyebrow">INVESTOR PORTAL</div>
        </div>
        <div className="login-title">Reset your password</div>
        <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", lineHeight: 1.6 }}>
          Enter the email on your invitation and we&apos;ll send you a link to set a new password.
        </div>
        <ForgotPasswordForm />
        <div style={{ textAlign: "center", fontSize: 12.5 }}>
          <Link href="/">← Back to sign-in</Link>
        </div>
      </div>
    </div>
  );
}
