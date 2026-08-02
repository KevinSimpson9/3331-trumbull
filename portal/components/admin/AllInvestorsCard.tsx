"use client";

import { Fragment, useState } from "react";
import AddInvestorForm from "./AddInvestorForm";
import EditInvestorForm from "./EditInvestorForm";
import RosterActions from "./RosterActions";

export interface RosterRowVM {
  id: string;
  initials: string;
  name: string;
  email: string;
  amount: string;
  terms: string;
  active: boolean;
  statusLabel: string;
  docsLabel: string;
  principalRaw: number;
  rateRaw: number;
  termRaw: number;
}

export default function AllInvestorsCard({ rows }: { rows: RosterRowVM[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <div className="admin-card-title">All investors</div>
        <button type="button" className="btn-gold btn-gold-sm" onClick={() => setAdding((v) => !v)}>
          + Add investor
        </button>
      </div>
      <div className="roster-list">
        {rows.map((r) => (
          <Fragment key={r.id}>
            <div className="roster-row">
              <div className="roster-ident">
                <div className="roster-avatar">{r.initials}</div>
                <div className="roster-name-col">
                  <div className="roster-name">{r.name}</div>
                  <div className="roster-email">{r.email}</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div className="roster-amount">{r.amount}</div>
                <div className="roster-terms">{r.terms}</div>
              </div>
              <div className="roster-status-col">
                <span className={`status-chip ${r.active ? "active" : "invited"}`}>
                  {r.statusLabel}
                </span>
                <span className="roster-docs-label">{r.docsLabel}</span>
              </div>
              <RosterActions
                investorId={r.id}
                investorName={r.name}
                onEdit={() => setEditingId((v) => (v === r.id ? null : r.id))}
              />
            </div>
            {editingId === r.id && (
              <div style={{ padding: "14px 0" }}>
                <EditInvestorForm row={r} onClose={() => setEditingId(null)} />
              </div>
            )}
          </Fragment>
        ))}
        {rows.length === 0 && (
          <div style={{ padding: "18px 0", fontSize: 13, color: "var(--muted)" }}>
            No investors yet — add your first investor to send a portal invite.
          </div>
        )}
      </div>
      {adding && <AddInvestorForm onClose={() => setAdding(false)} />}
    </div>
  );
}
