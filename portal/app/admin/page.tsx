import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth";
import { DOC_COUNT } from "@/lib/docs";
import { fmtDate, fmtMoney, initials } from "@/lib/format";
import type { Investor, Message, Signature } from "@/lib/types";
import PortalHeader from "@/components/PortalHeader";
import AllInvestorsCard, { type RosterRowVM } from "@/components/admin/AllInvestorsCard";
import MessagesCard, { type ThreadVM } from "@/components/admin/MessagesCard";
import type { BubbleVM } from "@/components/MessageThread";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { thread?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  if (!(await isAdminUser(supabase))) redirect("/room");

  const [{ data: investorsData }, { data: signaturesData }, { data: messagesData }] =
    await Promise.all([
      supabase.from("investors").select("*").order("created_at", { ascending: true }),
      supabase.from("signatures").select("*"),
      supabase.from("messages").select("*").order("sent_at", { ascending: true }),
    ]);

  const investors = (investorsData as Investor[]) ?? [];
  const signatures = (signaturesData as Signature[]) ?? [];
  const messages = (messagesData as Message[]) ?? [];

  const signedCount = (id: string) => signatures.filter((s) => s.investor_id === id).length;

  const stats = [
    { label: "INVESTORS", value: String(investors.length) },
    { label: "ACTIVE", value: String(investors.filter((i) => i.status === "active").length) },
    {
      label: "FULLY SIGNED",
      value: String(investors.filter((i) => signedCount(i.id) === DOC_COUNT).length),
    },
    {
      label: "COMMITTED CAPITAL",
      value: fmtMoney(investors.reduce((a, i) => a + Number(i.principal), 0)),
    },
  ];

  const rows: RosterRowVM[] = investors.map((i) => ({
    id: i.id,
    initials: initials(i.legal_name),
    name: i.legal_name,
    email: i.email,
    amount: fmtMoney(i.principal),
    terms: `${i.rate}% · ${i.term_months} mo · Interest`,
    active: i.status === "active",
    statusLabel: i.status === "active" ? "● Active" : "Invited",
    docsLabel: `${signedCount(i.id)} of ${DOC_COUNT} docs signed`,
  }));

  const threads: ThreadVM[] = investors.map((i) => {
    const list = messages.filter((m) => m.investor_id === i.id);
    const last = list[list.length - 1];
    const bubbles: BubbleVM[] = list.map((m) => ({
      id: m.id,
      text: m.body,
      mine: m.sender === "admin",
      meta: `${m.sender === "admin" ? "You" : "Investor"} · ${fmtDate(m.sent_at)}`,
    }));
    return {
      investorId: i.id,
      initials: initials(i.legal_name),
      name: i.legal_name,
      preview: last ? `${last.sender === "admin" ? "You: " : ""}${last.body}` : "No messages yet",
      unread: !!last && last.sender === "investor" && !last.read_at,
      messages: bubbles,
    };
  });

  const openThreadId =
    searchParams.thread && investors.some((i) => i.id === searchParams.thread)
      ? searchParams.thread
      : null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <PortalHeader signedInAs="Kevin Simpson" isAdmin />
      <div className="page-col page-col-admin">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="admin-title">Investor roster</div>
          <div className="admin-subtitle">
            All committed investors, their position, signing progress, and messages. Each investor
            sees only their own room.
          </div>
        </div>
        <div className="stat-grid">
          {stats.map((s) => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
            </div>
          ))}
        </div>
        <AllInvestorsCard rows={rows} />
        <MessagesCard threads={threads} openThreadId={openThreadId} />
      </div>
    </div>
  );
}
