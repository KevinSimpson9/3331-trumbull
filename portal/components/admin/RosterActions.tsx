"use client";

import Link from "next/link";
import { useTransition } from "react";
import { removeInvestorAction } from "@/app/actions/admin";
import { useToast } from "@/components/Toast";

interface Props {
  investorId: string;
  investorName: string;
}

export default function RosterActions({ investorId, investorName }: Props) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  return (
    <div className="roster-actions">
      <Link href={`/admin?thread=${investorId}#messages`} scroll={false} className="roster-btn" style={{ textDecoration: "none", display: "inline-block" }}>
        Message
      </Link>
      <Link href={`/admin/investor/${investorId}`} className="roster-btn" style={{ textDecoration: "none", display: "inline-block" }}>
        View their portal →
      </Link>
      <button
        type="button"
        title="Remove"
        className="roster-btn roster-remove"
        disabled={pending}
        onClick={() => {
          if (confirm(`Remove ${investorName} from the roster?`)) {
            startTransition(async () => {
              const res = await removeInvestorAction(investorId);
              if (res.error) toast(res.error);
            });
          }
        }}
      >
        ✕
      </button>
    </div>
  );
}
