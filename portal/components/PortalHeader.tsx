import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";

interface Props {
  signedInAs: string;
  isAdmin?: boolean;
  viewingAs?: boolean;
}

export default function PortalHeader({ signedInAs, isAdmin, viewingAs }: Props) {
  return (
    <div className="portal-header">
      <div className="portal-header-left">
        <span className="portal-wordmark">3331 Trumbull</span>
        <span className="portal-header-sub hide-mobile">· Investor Portal</span>
        {isAdmin && <span className="admin-chip">ADMIN</span>}
      </div>
      <div className="portal-header-right">
        {viewingAs && (
          <Link href="/admin" className="back-to-admin">
            ← Back to admin
          </Link>
        )}
        <span className="signed-in-as hide-mobile">
          <span className="gold-dot" />
          Signed in as {signedInAs}
        </span>
        <form action={signOutAction} style={{ display: "contents" }}>
          <button type="submit" className="sign-out-btn">
            SIGN OUT
          </button>
        </form>
      </div>
    </div>
  );
}
