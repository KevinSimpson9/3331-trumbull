import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth";
import { withEffectiveSchedule } from "@/lib/schedule";
import type { Investor, InvestorDocument, InvestorUpdate, Message } from "@/lib/types";
import PortalHeader from "@/components/PortalHeader";
import InvestorRoomView from "@/components/InvestorRoomView";
import InvestorDocsCard from "@/components/admin/InvestorDocsCard";
import InvestorUpdatesCard from "@/components/admin/InvestorUpdatesCard";
import { adminSendMessage } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

/** Per-investor back office: their document folder and targeted updates, above
 *  a clearly bannered view of the room as they see it. */
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
  // The room below shows what this investor sees; the card above manages only
  // the updates addressed to them specifically.
  const theirUpdates = allUpdates.filter(
    (u) => u.investor_id === null || u.investor_id === investor.id
  );

  return (
    <div style={{ minHeight: "100vh" }}>
      <PortalHeader signedInAs={investor.legal_name} viewingAs />
      <div className="page-col page-col-admin">
        <InvestorDocsCard
          investorId={investor.id}
          investorName={investor.legal_name}
          documents={docs}
        />
        <InvestorUpdatesCard
          updates={allUpdates.filter((u) => u.investor_id === investor.id)}
          lockedTo={{ id: investor.id, name: investor.legal_name }}
        />
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
