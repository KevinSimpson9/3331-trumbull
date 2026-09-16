import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/auth";
import { checkSetup } from "@/lib/setup";
import { emailConfigured, emailFrom, usingSandboxSender, getEmailLog } from "@/lib/email";
import { PAYMENT_SCHEDULES } from "@/lib/docs";
import { effectiveSchedule } from "@/lib/schedule";
import { fmtDate, fmtMoney, initials } from "@/lib/format";
import type { Investor, InvestorDocument, InvestorUpdate, Message } from "@/lib/types";
import PortalHeader from "@/components/PortalHeader";
import SetupBanner from "@/components/admin/SetupBanner";
import AllInvestorsCard, { type RosterRowVM } from "@/components/admin/AllInvestorsCard";
import InvestorUpdatesCard from "@/components/admin/InvestorUpdatesCard";
import MessagesCard, { type ThreadVM } from "@/components/admin/MessagesCard";
import EmailHealthCard from "@/components/admin/EmailHealthCard";
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

  const { data: investorsData } = await supabase
    .from("investors")
    .select("*")
    .order("created_at", { ascending: true });
  const investors = (investorsData as Investor[]) ?? [];

  const setup = await checkSetup();

  const [{ data: documentsData }, { data: messagesData }, { data: updatesData }, emailLog] =
    await Promise.all([
      supabase.from("investor_documents").select("*"),
      supabase.from("messages").select("*").order("sent_at", { ascending: true }),
      supabase.from("investor_updates").select("*").order("posted_at", { ascending: false }),
      getEmailLog(),
    ]);

  const documents = (documentsData as InvestorDocument[]) ?? [];
  const messages = (messagesData as Message[]) ?? [];
  const updates = (updatesData as InvestorUpdate[]) ?? [];

  const scheduleByInvestor = new Map(
    await Promise.all(
      investors.map(async (i) => [i.id, await effectiveSchedule(i)] as const)
    )
  );

  const docCount = (id: string) => documents.filter((d) => d.investor_id === id).length;

  const stats = [
    { label: "INVESTORS", value: String(investors.length) },
    { label: "ACTIVE", value: String(investors.filter((i) => i.status === "active").length) },
    {
      label: "AWAITING CONFIRMATION",
      value: String(
        documents.filter((d) => d.acknowledgment_requested && !d.acknowledged_at).length
      ),
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
    terms: `${i.rate}% · ${i.term_months} mo · ${PAYMENT_SCHEDULES[scheduleByInvestor.get(i.id) ?? "quarterly"].short}`,
    active: i.status === "active",
    statusLabel: i.status === "active" ? "● Active" : "Invited",
    docsLabel:
      docCount(i.id) === 0
        ? "No documents filed"
        : `${docCount(i.id)} document${docCount(i.id) === 1 ? "" : "s"} on file`,
    principalRaw: Number(i.principal),
    rateRaw: Number(i.rate),
    termRaw: i.term_months,
    paymentRaw: scheduleByInvestor.get(i.id) ?? "quarterly",
    statusRaw: i.status,
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
            All committed investors, their position, the documents on file, and messages. Each
            investor sees only their own room.
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
        {!setup.ready && <SetupBanner missing={setup.missing} />}
        <AllInvestorsCard rows={rows} />
        <InvestorUpdatesCard
          updates={updates}
          investors={investors.map((i) => ({ id: i.id, name: i.legal_name }))}
        />
        <MessagesCard threads={threads} openThreadId={openThreadId} />
        <EmailHealthCard
          health={{
            configured: emailConfigured(),
            from: emailFrom(),
            sandbox: emailConfigured() && usingSandboxSender(),
            adminEmail: ADMIN_EMAIL,
          }}
          log={emailLog}
        />
      </div>
    </div>
  );
}
