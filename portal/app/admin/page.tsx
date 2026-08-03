import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, ADMIN_EMAIL } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/auth";
import { emailConfigured, emailFrom, usingSandboxSender, getEmailLog } from "@/lib/email";
import { DOC_COUNT, PAYMENT_SCHEDULES } from "@/lib/docs";
import { effectiveSchedule } from "@/lib/schedule";
import { SIGNED_DOCS_BUCKET } from "@/lib/pdf";
import { fmtDate, fmtMoney, initials } from "@/lib/format";
import type { Investor, Message, Signature } from "@/lib/types";
import PortalHeader from "@/components/PortalHeader";
import AllInvestorsCard, { type RosterRowVM } from "@/components/admin/AllInvestorsCard";
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

  // Self-healing cleanup: the accreditation document was removed from the
  // portal, so purge any leftover signature rows and stored PDFs. Idempotent
  // and cheap — runs on every admin visit so no SQL console is ever needed.
  try {
    const adminDb = createAdminClient();
    await adminDb.from("signatures").delete().eq("doc_key", "accreditation");
    if (investors.length) {
      await adminDb.storage
        .from(SIGNED_DOCS_BUCKET)
        .remove(investors.map((i) => `${i.id}/accreditation.pdf`));
    }
  } catch {
    // cleanup is best-effort; the rows are also invisible to the app either way
  }

  const [{ data: signaturesData }, { data: messagesData }, emailLog] = await Promise.all([
    supabase.from("signatures").select("*"),
    supabase.from("messages").select("*").order("sent_at", { ascending: true }),
    getEmailLog(),
  ]);

  const signatures = (signaturesData as Signature[]) ?? [];
  const messages = (messagesData as Message[]) ?? [];

  const scheduleByInvestor = new Map(
    await Promise.all(
      investors.map(async (i) => [i.id, await effectiveSchedule(i)] as const)
    )
  );

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
    terms: `${i.rate}% · ${i.term_months} mo · ${PAYMENT_SCHEDULES[scheduleByInvestor.get(i.id) ?? "quarterly"].short}`,
    active: i.status === "active",
    statusLabel: i.status === "active" ? "● Active" : "Invited",
    docsLabel: `${signedCount(i.id)} of ${DOC_COUNT} docs signed`,
    principalRaw: Number(i.principal),
    rateRaw: Number(i.rate),
    termRaw: i.term_months,
    paymentRaw: scheduleByInvestor.get(i.id) ?? "quarterly",
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
