import { PAYMENT_SCHEDULES } from "@/lib/docs";
import { firstName, fmtDate, fmtMoney } from "@/lib/format";
import type { Investor, InvestorDocument, Message, ProjectDocument } from "@/lib/types";
import type { FormState } from "@/app/actions/auth";
import InvestorDocsSection from "./InvestorDocsSection";
import MessageThread, { type BubbleVM } from "./MessageThread";

interface Props {
  investor: Investor;
  documents: InvestorDocument[];
  messages: Message[];
  projectDocs: ProjectDocument[];
  sendAction: (formData: FormData) => Promise<FormState>;
  viewingAs?: boolean;
}

function SectionHead({ title, ordinal }: { title: string; ordinal: string }) {
  return (
    <div className="section-head">
      <div className="section-title">{title}</div>
      <div className="section-ordinal">— {ordinal}</div>
    </div>
  );
}

export default function InvestorRoomView({
  investor,
  documents,
  messages,
  projectDocs,
  sendAction,
  viewingAs,
}: Props) {
  const stats = [
    { label: "YOUR PRINCIPAL", value: fmtMoney(investor.principal) },
    { label: "RATE", value: `${investor.rate}%` },
    { label: "TERM", value: `${investor.term_months} MO` },
    { label: "INTEREST", value: PAYMENT_SCHEDULES[investor.payment_schedule ?? "quarterly"].short.toUpperCase() },
  ];

  // In the investor's room "mine" = investor messages; when Kevin is viewing
  // as an investor his replies come from the composer and are admin messages.
  const mineFrom = viewingAs ? "admin" : "investor";
  const bubbles: BubbleVM[] = messages.map((m) => {
    const mine = m.sender === mineFrom;
    const who = m.sender === "admin" ? (viewingAs ? "You" : "Kevin Simpson") : mine ? "You" : "Investor";
    return { id: m.id, text: m.body, mine, meta: `${who} · ${fmtDate(m.sent_at)}` };
  });

  return (
    <div className="page-col">
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="room-hero">
          <div className="room-hero-content">
            <div className="room-hero-eyebrow">3331 TRUMBULL · DETROIT</div>
            <div className="welcome-title">Welcome, {firstName(investor.legal_name)}.</div>
            <div className="privacy-note">
              Your private room — only you and Kevin can see what&apos;s here.
            </div>
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
      </div>

      <div className="section">
        <SectionHead title="Your documents" ordinal="01" />
        <div className="section-blurb">
          Your signed documents, wire instructions and project updates, all in one place.
          Anything requiring your signature is sent through DocuSign; the fully executed copy
          is filed here for you to view or download anytime.
        </div>
        <InvestorDocsSection documents={documents} viewingAs={viewingAs} />
      </div>

      <div className="section">
        <SectionHead title="Project documents" ordinal="02" />
        {projectDocs.length === 0 && (
          <div className="empty-panel">
            <div className="empty-panel-title">Nothing here yet</div>
            <div className="empty-panel-body">
              Project materials will appear here as they&apos;re published.
            </div>
          </div>
        )}
        <div className="link-card-grid">
          {projectDocs.map((d) => (
            <a
              key={d.id}
              className="link-card"
              href={d.href ?? `/api/doc/${d.id}`}
              target={d.href ? "_blank" : undefined}
              rel={d.href ? "noopener noreferrer" : undefined}
            >
              <div className="doc-glyph">
                <span className="doc-glyph-badge">{d.badge}</span>
              </div>
              <div className="link-card-main">
                <div className="link-card-title">{d.title}</div>
                <div className="link-card-desc">{d.description}</div>
              </div>
              <span className="link-card-arrow">→</span>
            </a>
          ))}
        </div>
      </div>

      <div className="section">
        <SectionHead title="Messages" ordinal="03" />
        <div className="chat-card">
          <div className="chat-head">
            <div className="avatar">KS</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div className="chat-head-name">Kevin Simpson</div>
              <div className="chat-head-role">Investor Relations · AK Capital Investments</div>
            </div>
          </div>
          <MessageThread
            messages={bubbles}
            placeholder={viewingAs ? "Reply as Kevin…" : "Write a message to Kevin…"}
            sendAction={sendAction}
          />
        </div>
      </div>

      <div className="footer-contacts">
        <div className="footer-block">
          <div className="footer-eyebrow">INVESTOR RELATIONS</div>
          <div className="footer-name">Kevin Simpson</div>
          <div className="footer-org">AK Capital Investments</div>
          <a href="mailto:kevin@akcapital.fund">kevin@akcapital.fund</a>
        </div>
        <div className="footer-block">
          <div className="footer-eyebrow">DEVELOPER</div>
          <div className="footer-name">Lukas Bondy</div>
          <div className="footer-org">Bondy Construction &amp; Design</div>
        </div>
      </div>
    </div>
  );
}
