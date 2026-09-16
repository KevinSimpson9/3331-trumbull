"use client";

import { useRef, useState, useTransition } from "react";
import {
  createUpdateUploadTicket,
  deleteInvestorUpdateAction,
  postInvestorUpdateAction,
} from "@/app/actions/admin";
import { badgeFor, fmtFileSize, MAX_UPLOAD_BYTES } from "@/lib/investorDocs";
import { fmtDate } from "@/lib/format";
import { uploadToSignedUrl } from "@/lib/upload";
import { useToast } from "@/components/Toast";
import type { InvestorUpdate } from "@/lib/types";

export interface UpdateAudience {
  id: string;
  name: string;
}

/** Posts progress reports. An update is a written note, a file, or both, and
 *  goes to every investor unless one is picked. */
export default function InvestorUpdatesCard({
  updates,
  investors,
  lockedTo,
}: {
  updates: InvestorUpdate[];
  /** Roster for the audience picker. Omitted on a single investor's page. */
  investors?: UpdateAudience[];
  /** When set, the card posts only to this investor. */
  lockedTo?: UpdateAudience;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState(lockedTo?.id ?? "all");
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    data.set("audience", audience);

    const file = data.get("file");
    const hasFile = file instanceof File && file.size > 0;

    if (hasFile) {
      const upload = file as File;
      if (upload.size > MAX_UPLOAD_BYTES) {
        setError(`That file is larger than ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
        return;
      }
      setBusy("Uploading…");
      const ticket = await createUpdateUploadTicket(
        audience === "all" ? null : audience,
        upload.name,
        upload.size
      );
      if (!ticket.ok || !ticket.uploadUrl || !ticket.path) {
        setBusy(null);
        setError(ticket.error || "Could not start the upload.");
        return;
      }
      const uploadError = await uploadToSignedUrl(ticket.uploadUrl, upload);
      if (uploadError) {
        setBusy(null);
        setError(uploadError);
        return;
      }
      data.set("storagePath", ticket.path);
      data.set("fileName", upload.name);
      data.set("contentType", upload.type || "");
      data.set("fileSize", String(upload.size));
    }

    setBusy("Posting…");
    data.delete("file");
    const res = await postInvestorUpdateAction({}, data);
    setBusy(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    toast(res.message || "Update posted ✓");
    form.reset();
    setAudience(lockedTo?.id ?? "all");
    setOpen(false);
  }

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <div className="admin-card-title">
          {lockedTo ? `Updates — ${lockedTo.name}` : "Investor updates"}
        </div>
        <button type="button" className="btn-gold btn-gold-sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "+ Post update"}
        </button>
      </div>
      <div className="form-helper" style={{ marginBottom: 4 }}>
        {lockedTo
          ? `Posts to ${lockedTo.name} only. Updates for everyone are posted from the dashboard.`
          : "Goes to every investor unless you pick one. A note, a file, or both."}
      </div>

      <div className="doc-rows">
        {updates.map((u) => (
          <div key={u.id} className="update-row">
            <div className="update-head">
              <div className="update-title">{u.title}</div>
              <span className="doc-row-actions">
                <span className="update-date">
                  {u.investor_id ? "Targeted" : "Everyone"} · {fmtDate(u.posted_at)}
                </span>
                <button
                  type="button"
                  className="roster-btn roster-remove"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`Remove "${u.title}"? Investors lose access to it.`)) {
                      startTransition(async () => {
                        const res = await deleteInvestorUpdateAction(u.id);
                        toast(res.error || res.message || "Removed");
                      });
                    }
                  }}
                >
                  ✕
                </button>
              </span>
            </div>
            {u.body && <div className="update-body">{u.body}</div>}
            {u.storage_path && u.file_name && (
              <a className="update-attachment" href={`/api/update/${u.id}`} target="_blank" rel="noopener noreferrer">
                <span className="doc-glyph">
                  <span className="doc-glyph-badge">{badgeFor(u.file_name)}</span>
                </span>
                <span className="update-attachment-main">
                  <span className="update-attachment-name">{u.file_name}</span>
                  <span className="update-attachment-size">{fmtFileSize(u.file_size)}</span>
                </span>
                <span className="link-card-arrow">→</span>
              </a>
            )}
          </div>
        ))}
        {updates.length === 0 && !open && (
          <div className="empty-row">
            {lockedTo
              ? `No updates addressed to ${lockedTo.name} yet.`
              : "No updates posted yet."}
          </div>
        )}
      </div>

      {open && (
        <form ref={formRef} onSubmit={handleSubmit} className="dashed-panel">
          <div className="dashed-panel-title">Post an update</div>
          <div className="split">
            <div className="field field-tight">
              <label className="label label-sm">TITLE</label>
              <input name="title" className="input input-sm" placeholder="e.g. Q3 construction update" />
            </div>
            <div className="field field-tight">
              <label className="label label-sm">WHO SEES IT</label>
              {lockedTo || !investors ? (
                <input className="input input-sm" value={lockedTo?.name ?? "Every investor"} readOnly disabled />
              ) : (
                <select
                  className="input input-sm"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                >
                  <option value="all">Every investor</option>
                  {investors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} only
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className="field field-tight">
            <label className="label label-sm">NOTE</label>
            <textarea
              name="body"
              className="input input-sm"
              rows={4}
              placeholder="Framing is complete on units 1 through 8…"
            />
          </div>
          <div className="field field-tight">
            <label className="label label-sm">ATTACHMENT — OPTIONAL (MAX 25 MB)</label>
            <input
              name="file"
              type="file"
              className="input input-sm"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            />
          </div>
          <div className="form-helper">A note, a file, or both. At least one.</div>
          {error && <div className="error-text">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={!!busy}>
              Cancel
            </button>
            <button type="submit" className="btn-gold btn-gold-sm" disabled={!!busy}>
              {busy ?? "Post update"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
