import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth";
import { DEFAULT_PROJECT_DOCS, docDefs } from "@/lib/docs";
import { withEffectiveSchedule } from "@/lib/schedule";
import type { Investor, Message, ProjectDocument, Signature } from "@/lib/types";
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

  // Whenever signing is due, open the signing flow automatically at the first
  // unsigned document — from there the modal advances through the rest in
  // order. An explicit ?sign= key (invite/set-password links) takes priority
  // as the starting point, unless that document is already signed.
  const signedKeys = new Set((signatures ?? []).map((s) => (s as Signature).doc_key));
  const unsignedKeys = docDefs(investor)
    .map((d) => d.key)
    .filter((k) => !signedKeys.has(k));
  const requested = searchParams.sign;
  const autoOpenKey =
    requested && unsignedKeys.includes(requested as (typeof unsignedKeys)[number])
      ? requested
      : unsignedKeys[0];

  return (
    <div style={{ minHeight: "100vh" }}>
      <PortalHeader signedInAs={investor.legal_name} />
      <InvestorRoomView
        investor={investor}
        signatures={(signatures as Signature[]) ?? []}
        messages={(messages as Message[]) ?? []}
        projectDocs={docs}
        sendAction={sendInvestorMessage}
        autoOpenKey={autoOpenKey}
      />
    </div>
  );
}
