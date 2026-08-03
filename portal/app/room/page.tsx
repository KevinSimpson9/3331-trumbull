import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth";
import { loadProjectDocs } from "@/lib/projectDocs";
import { withEffectiveSchedule } from "@/lib/schedule";
import type { Investor, Message, Signature } from "@/lib/types";
import PortalHeader from "@/components/PortalHeader";
import InvestorRoomView from "@/components/InvestorRoomView";
import { sendInvestorMessage } from "@/app/actions/investor";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  searchParams,
}: {
  searchParams: { sign?: string };
}) {
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

  const [{ data: signatures }, { data: messages }, docs] = await Promise.all([
    supabase.from("signatures").select("*").eq("investor_id", investor.id),
    supabase
      .from("messages")
      .select("*")
      .eq("investor_id", investor.id)
      .order("sent_at", { ascending: true }),
    loadProjectDocs(supabase),
  ]);

  return (
    <div style={{ minHeight: "100vh" }}>
      <PortalHeader signedInAs={investor.legal_name} />
      <InvestorRoomView
        investor={investor}
        signatures={(signatures as Signature[]) ?? []}
        messages={(messages as Message[]) ?? []}
        projectDocs={docs}
        sendAction={sendInvestorMessage}
        autoOpenKey={searchParams.sign}
      />
    </div>
  );
}
