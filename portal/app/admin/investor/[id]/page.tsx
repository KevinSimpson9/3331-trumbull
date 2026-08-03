import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth";
import { DEFAULT_PROJECT_DOCS } from "@/lib/docs";
import { withEffectiveSchedule } from "@/lib/schedule";
import type { Investor, Message, ProjectDocument, Signature } from "@/lib/types";
import PortalHeader from "@/components/PortalHeader";
import InvestorRoomView from "@/components/InvestorRoomView";
import { adminSendMessage } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

/** Admin impersonation: read-mostly view of one investor's room, clearly bannered. */
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

  const [{ data: signatures }, { data: messages }, { data: projectDocs }] = await Promise.all([
    supabase.from("signatures").select("*").eq("investor_id", investor.id),
    supabase
      .from("messages")
      .select("*")
      .eq("investor_id", investor.id)
      .order("sent_at", { ascending: true }),
    supabase.from("project_documents").select("*").order("sort", { ascending: true }),
  ]);

  const docs: ProjectDocument[] =
    projectDocs && projectDocs.length ? projectDocs : (DEFAULT_PROJECT_DOCS as ProjectDocument[]);

  return (
    <div style={{ minHeight: "100vh" }}>
      <PortalHeader signedInAs={investor.legal_name} viewingAs />
      <InvestorRoomView
        investor={investor}
        signatures={(signatures as Signature[]) ?? []}
        messages={(messages as Message[]) ?? []}
        projectDocs={docs}
        sendAction={adminSendMessage.bind(null, investor.id)}
        viewingAs
      />
    </div>
  );
}
