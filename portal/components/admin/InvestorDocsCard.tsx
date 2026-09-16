"use client";

import { useRef, useState, useTransition } from "react";
import {
  createInvestorUploadTicket,
  deleteInvestorDocumentAction,
  setAcknowledgmentRequestAction,
  uploadInvestorDocumentAction,
} from "@/app/actions/admin";
import {
  badgeFor,
  DOC_TYPE_SUGGESTIONS,
  fmtExecutedOn,
  fmtFileSize,
  MAX_UPLOAD_BYTES,
} from "@/lib/investorDocs";
import { fmtDate } from "@/lib/format";
import { uploadToSignedUrl } from "@/lib/upload";
import { useToast } from "@/components/Toast";
import type { InvestorDocument } from "@/lib/types";

/** Back-office filing cabinet: the investor's executed DocuSign copies, their
 *  wire instructions, and the investor updates filed to their folder. */
export default function InvestorDocsCard({
  investorId,
  investorName,
  documents,
}: {
  investorId: string;
  investorName: string;
  documents: InvestorDocument[];
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  /** Two phases: the bytes go browser → Supabase against a signed URL, then
   *  the metadata is filed. Only the second step is a server action, so the
   *  file size is bounded by Supabase rather than by Vercel's 4.5 MB body cap. */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a file to upload.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`That file is larger than ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
      return;
    }

    setBusy("Preparing…");
    const ticket = await createInvestorUploadTicket(investorId, file.name, file.size);
    if (!ticket.ok || !ticket.uploadUrl || !ticket.path) {
      setBusy(null);
      setError(ticket.error || "Could not start the upload.");
      return;
    }

    setBusy("Uploading…");
    const uploadError = await uploadToSignedUrl(ticket.uploadUrl, file);
    if (uploadError) {
      setBusy(null);
      setError(uploadError);
      return;
    }

    setBusy("Filing…");
    data.delete("file");
    data.set("storagePath", ticket.path);
    data.set("fileName", file.name);
    data.set("contentType", file.type || "");
    data.set("fileSize", String(file.size));

    const res = await uploadInvestorDocumentAction({}, data);
    setBusy(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    toast(res.message || "Document filed ✓");
    form.reset();
  }

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <div className="admin-card-title">Documents — {investorName}</div>
        <button type="button" className="btn-gold btn-gold-sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "+ Upload document"}
        </button>
      </div>

      <div className="doc-rows">
        {documents.map((d) => {
          const executed = fmtExecutedOn(d.executed_on);
          const size = fmtFileSize(d.file_size);
          return (
            <div key={d.id} className="doc-row">
              <div className="doc-glyph">
                <span className="doc-glyph-badge">{badgeFor(d.file_name)}</span>
              </div>
              <div className="doc-row-main">
                <div className="doc-row-title">{d.title}</div>
                <div className="doc-row-desc">
                  {[
                    d.doc_type,
                    d.uploaded_by === "investor" ? "uploaded by them" : null,
                    executed ? `executed ${executed}` : null,
                    size,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <span className="doc-row-actions">
                {d.acknowledged_at ? (
                  <span className="signed-chip">
                    ✓ Confirmed {fmtDate(d.acknowledged_at)}
                    {d.acknowledged_name ? ` by ${d.acknowledged_name}` : ""}
                  </span>
                ) : d.acknowledgment_requested ? (
                  <button
                    type="button"
                    className="roster-btn"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await setAcknowledgmentRequestAction(d.id, false);
                        toast(res.error || res.message || "Cleared");
                      })
                    }
                  >
                    Awaiting confirmation · cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    className="roster-btn"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await setAcknowledgmentRequestAction(d.id, true);
                        toast(res.error || res.message || "Requested");
                      })
                    }
                  >
                    Request confirmation
                  </button>
                )}
                <a
                  className="signed-download"
                  href={`/api/investor-doc/${d.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View
                </a>
                <button
                  type="button"
                  className="roster-btn roster-delete"
                  disabled={pending || deletingId === d.id}
                  onClick={() => {
                    const warning =
                      `Delete "${d.title}" from ${investorName}'s folder?\n\n` +
                      `The file is permanently removed from storage and disappears from their ` +
                      `room. This cannot be undone` +
                      (d.acknowledged_at
                        ? `, and the record of them confirming receipt on ` +
                          `${fmtDate(d.acknowledged_at)} goes with it.`
                        : `.`);
                    if (confirm(warning)) {
                      setDeletingId(d.id);
                      startTransition(async () => {
                        const res = await deleteInvestorDocumentAction(d.id);
                        setDeletingId(null);
                        toast(res.error || res.message || "Document deleted");
                      });
                    }
                  }}
                >
                  {deletingId === d.id ? "Deleting…" : "Delete"}
                </button>
              </span>
            </div>
          );
        })}
        {documents.length === 0 && !open && (
          <div className="empty-row">
            Nothing filed yet. Upload their executed DocuSign copies and wire instructions.
          </div>
        )}
      </div>

      {open && (
        <form ref={formRef} onSubmit={handleSubmit} className="dashed-panel">
          <input type="hidden" name="investorId" value={investorId} />
          <div className="dashed-panel-title">Upload a document</div>
          <div className="split">
            <div className="field field-tight">
              <label className="label label-sm">TITLE SHOWN TO THE INVESTOR</label>
              <input
                name="title"
                className="input input-sm"
                placeholder="e.g. Promissory Note"
              />
            </div>
            <div className="field field-tight">
              <label className="label label-sm">DOCUMENT TYPE</label>
              <input
                name="docType"
                className="input input-sm"
                list="doc-type-options"
                placeholder="Promissory Note"
              />
              <datalist id="doc-type-options">
                {DOC_TYPE_SUGGESTIONS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="split">
            <div className="field field-tight">
              <label className="label label-sm">DATE EXECUTED (BLANK IF UNSIGNED)</label>
              <input name="executedOn" type="date" className="input input-sm" />
            </div>
            <div className="field field-tight">
              <label className="label label-sm">FILE (PDF, WORD, EXCEL OR IMAGE · MAX 25 MB)</label>
              <input
                name="file"
                type="file"
                className="input input-sm"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                required
              />
            </div>
          </div>
          <label className="consent-row">
            <input type="checkbox" name="notify" defaultChecked />
            <span>Email {investorName} to let them know the document is in their folder.</span>
          </label>
          <div className="form-helper">
            Leave the date blank for anything unsigned, like wire instructions. Filing always
            posts a note in their message thread.
          </div>
          {error && <div className="error-text">{error}</div>}
          <div className="form-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setOpen(false)}
              disabled={!!busy}
            >
              Cancel
            </button>
            <button type="submit" className="btn-gold btn-gold-sm" disabled={!!busy}>
              {busy ?? "File document"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
