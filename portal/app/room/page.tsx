import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth";
import { withEffectiveSchedule } from "@/lib/schedule";
import type { Investor, InvestorDocument, Message, ProjectDocument } from "@/lib/types";
import PortalHeader from "@/components/PortalHeader";
import InvestorRoomView from "@/components/InvestorRoomView";
import { sendInvestorMessage } from "@/app/actions/investor";

export const dynamic = "force-dynamic";

export default async function RoomPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  if (await isAdminUser(supabase)) redirect("/admin");

  const { data: investorRow } = await supabase
    .from("investors")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle<Investor>();
  if (!investorRow) redirect("/");
  const investor = await withEffectiveSchedule(investorRow);

  // RLS scopes all three reads to this investor.
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

  return (
    <div style={{ minHeight: "100vh" }}>
      <PortalHeader signedInAs={investor.legal_name} />
      <InvestorRoomView
        investor={investor}
        documents={(documents as InvestorDocument[]) ?? []}
        messages={(messages as Message[]) ?? []}
        projectDocs={(projectDocs as ProjectDocument[]) ?? []}
        sendAction={sendInvestorMessage}
      />
    </div>
  );
}
