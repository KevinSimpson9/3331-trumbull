import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth";
import { withEffectiveSchedule } from "@/lib/schedule";
import type { Investor, InvestorDocument, Message, ProjectDocument } from "@/lib/types";
import PortalHeader from "@/components/PortalHeader";
import InvestorRoomView from "@/components/InvestorRoomView";
import InvestorDocsCard from "@/components/admin/InvestorDocsCard";
import { adminSendMessage } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

/** Per-investor back office: the filing cabinet for their executed DocuSign
 *  documents, above a clearly bannered view of the room as they see it. */
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

  const [{ data: documents }, { data: messages }, { data: projectDocs }] = await Promise.all([
    supabase
      .from("investor_documents")
      .select("*")
      .eq("investor_id", investor.id)
      .order("sort", { ascending: true })
      .order("uploaded_at", { ascending: true }),
    supabase
      .from("messages")
      .select("*")
      .eq("investor_id", investor.id)
      .order("sent_at", { ascending: true }),
    supabase.from("project_documents").select("*").order("sort", { ascending: true }),
  ]);

  const docs = (documents as InvestorDocument[]) ?? [];

  return (
    <div style={{ minHeight: "100vh" }}>
      <PortalHeader signedInAs={investor.legal_name} viewingAs />
      <div className="page-col page-col-admin">
        <InvestorDocsCard
          investorId={investor.id}
          investorName={investor.legal_name}
          documents={docs}
        />
      </div>
      <InvestorRoomView
        investor={investor}
        documents={docs}
        messages={(messages as Message[]) ?? []}
        projectDocs={(projectDocs as ProjectDocument[]) ?? []}
        sendAction={adminSendMessage.bind(null, investor.id)}
        viewingAs
      />
    </div>
  );
}
