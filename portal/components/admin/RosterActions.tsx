"use client";

import Link from "next/link";
import { useTransition } from "react";
import { getInviteLinkAction, removeInvestorAction, resetInvestorDocsAction } from "@/app/actions/admin";
import { useToast } from "@/components/Toast";

interface Props {
  investorId: string;
  investorName: string;
  onEdit: () => void;
}

export default function RosterActions({ investorId, investorName, onEdit }: Props) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  return (
    <div className="roster-actions">
      <button type="button" className="roster-btn" onClick={onEdit}>
        Edit
      </button>
      <Link href={`/admin?thread=${investorId}#messages`} scroll={false} className="roster-btn" style={{ textDecoration: "none", display: "inline-block" }}>
        Message
      </Link>
      <Link href={`/admin/investor/${investorId}`} className="roster-btn" style={{ textDecoration: "none", display: "inline-block" }}>
        View their portal →
      </Link>
      <button
        type="button"
        className="roster-btn"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await getInviteLinkAction(investorId);
            if (res.inviteLink) {
              try {
                await navigator.clipboard.writeText(res.inviteLink);
                toast("Invite link copied — send it to them ✓");
              } catch {
                window.prompt(`Sign-in link for ${investorName} — copy it:`, res.inviteLink);
              }
            } else {
              toast(res.error || "Couldn't create link");
            }
          })
        }
      >
        Copy invite link
      </button>
      <button
        type="button"
        className="roster-btn"
        disabled={pending}
        onClick={() => {
          if (
            confirm(
              `Clear ${investorName}'s signed documents so they can re-sign the current versions? Their old PDFs are deleted.`
            )
          ) {
            startTransition(async () => {
              const res = await resetInvestorDocsAction(investorId);
              toast(res.error || res.message || "Signed docs cleared ✓");
            });
          }
        }}
      >
        Reset docs
      </button>
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
