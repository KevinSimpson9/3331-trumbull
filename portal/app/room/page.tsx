import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth";
import { withEffectiveSchedule } from "@/lib/schedule";
import type { Investor, InvestorDocument, InvestorUpdate, Message } from "@/lib/types";
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

  // RLS scopes all three reads: own documents, own thread, and updates that
  // are either shared with everyone or targeted at this investor.
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

  return (
    <div style={{ minHeight: "100vh" }}>
      <PortalHeader signedInAs={investor.legal_name} />
      <InvestorRoomView
        investor={investor}
        documents={(documents as InvestorDocument[]) ?? []}
        updates={(updates as InvestorUpdate[]) ?? []}
        messages={(messages as Message[]) ?? []}
        sendAction={sendInvestorMessage}
      />
    </div>
  );
}
