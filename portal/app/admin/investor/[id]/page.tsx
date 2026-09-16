import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth";
import { withEffectiveSchedule } from "@/lib/schedule";
import { PAYMENT_SCHEDULES } from "@/lib/docs";
import { fmtMoney, initials } from "@/lib/format";
import type { Investor, InvestorDocument, InvestorUpdate, Message } from "@/lib/types";
import PortalHeader from "@/components/PortalHeader";
import InvestorRoomView from "@/components/InvestorRoomView";
import InvestorDocsCard from "@/components/admin/InvestorDocsCard";
import InvestorUpdatesCard from "@/components/admin/InvestorUpdatesCard";
import { adminSendMessage } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

/** Per-investor back office. This is an admin tool that *contains* a preview of
 *  the investor's room, so it leads with who is being managed and marks the
 *  preview explicitly — it is never mistaken for the investor's own view. */
export default async function ViewAsInvestorPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  if (!(await isAdminUser(supabase))) redirect("/room");

  const { data: investorRow } = await supabase
    .from("investors")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<Investor>();
  if (!investorRow) redirect("/admin");
  const investor = await withEffectiveSchedule(investorRow);

  const [{ data: documents }, { data: updates }, { data: messages }] = await Promise.all([
    supabase
      .from("investor_documents")
      .select("*")
      .eq("investor_id", investor.id)
      .order("sort", { ascending: true })
      .order("uploaded_at", { ascending: true }),
    supabase.from("investor_updates").select("*").order("posted_at", { ascending: false }),
    supabase
      .from("messages")
      .select("*")
      .eq("investor_id", investor.id)
      .order("sent_at", { ascending: true }),
  ]);

  const docs = (documents as InvestorDocument[]) ?? [];
  const allUpdates = (updates as InvestorUpdate[]) ?? [];
  const theirUpdates = allUpdates.filter(
    (u) => u.investor_id === null || u.investor_id === investor.id
  );

  const schedule = PAYMENT_SCHEDULES[investor.payment_schedule ?? "quarterly"].short;

  return (
    <div style={{ minHeight: "100vh" }}>
      <PortalHeader signedInAs="Kevin Simpson" managing={investor.legal_name} />
      <div className="page-col page-col-admin">
        <div className="subject-head">
          <div className="subject-avatar">{initials(investor.legal_name)}</div>
          <div className="subject-ident">
            <div className="subject-name">{investor.legal_name}</div>
            <div className="subject-email">{investor.email}</div>
          </div>
          <div className="subject-facts">
            <span className="subject-fact">{fmtMoney(investor.principal)}</span>
            <span className="subject-fact">
              {investor.rate}% · {investor.term_months} mo · {schedule}
            </span>
            <span className={`status-chip ${investor.status === "active" ? "active" : "invited"}`}>
              {investor.status === "active" ? "● Active" : "Invited"}
            </span>
          </div>
        </div>

        <InvestorDocsCard
          investorId={investor.id}
          investorName={investor.legal_name}
          documents={docs}
        />
        <InvestorUpdatesCard
          updates={allUpdates.filter((u) => u.investor_id === investor.id)}
          lockedTo={{ id: investor.id, name: investor.legal_name }}
        />

        <div className="preview-divider">
          <span className="preview-divider-label">
            Below is {investor.legal_name}&apos;s room, exactly as they see it
          </span>
        </div>
      </div>
      <InvestorRoomView
        investor={investor}
        documents={docs}
        updates={theirUpdates}
        messages={(messages as Message[]) ?? []}
        sendAction={adminSendMessage.bind(null, investor.id)}
        viewingAs
      />
    </div>
  );
}
