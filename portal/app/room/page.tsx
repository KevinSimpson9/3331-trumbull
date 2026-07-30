import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/supabase/admin";
import { DEFAULT_PROJECT_DOCS } from "@/lib/docs";
import type { Investor, Message, ProjectDocument, Signature } from "@/lib/types";
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
  if ((user.email || "").toLowerCase() === ADMIN_EMAIL) redirect("/admin");

  const { data: investor } = await supabase
    .from("investors")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle<Investor>();
  if (!investor) redirect("/");

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
      <PortalHeader signedInAs={investor.legal_name} />
      <InvestorRoomView
        investor={investor}
        signatures={(signatures as Signature[]) ?? []}
        messages={(messages as Message[]) ?? []}
        projectDocs={docs}
        sendAction={sendInvestorMessage}
      />
    </div>
  );
}
