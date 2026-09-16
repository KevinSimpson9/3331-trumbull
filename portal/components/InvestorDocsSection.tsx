"use client";

import { useRef, useState, useTransition } from "react";
import {
  createSelfUploadTicket,
  deleteOwnDocumentAction,
  uploadOwnDocumentAction,
} from "@/app/actions/investor";
import {
  badgeFor,
  fmtExecutedOn,
  fmtFileSize,
  INVESTOR_DOC_TYPE_SUGGESTIONS,
  MAX_UPLOAD_BYTES,
} from "@/lib/investorDocs";
import { fmtDate } from "@/lib/format";
import { uploadToSignedUrl } from "@/lib/upload";
import { useToast } from "@/components/Toast";
import type { InvestorDocument } from "@/lib/types";
import SignDocumentModal from "./SignDocumentModal";

/** The investor's document folder: what Kevin filed for them, what they signed,
 *  and anything they uploaded themselves (banking details for ACH or wire). */
export default function InvestorDocsSection({
  documents,
  legalName,
  viewingAs,
}: {
  documents: InvestorDocument[];
  legalName: string;
  viewingAs?: boolean;
}) {
  const [signingId, setSigningId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  const signing = documents.find((d) => d.id === signingId) ?? null;

  /** Bytes go browser → Supabase against a signed URL; only the metadata
   *  travels through a server action. */
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

    setBusy("Uploading…");
    const ticket = await createSelfUploadTicket(file.name, file.size);
    if (!ticket.ok || !ticket.uploadUrl || !ticket.path) {
      setBusy(null);
      setError(ticket.error || "Could not start the upload.");
      return;
    }

    const uploadError = await uploadToSignedUrl(ticket.uploadUrl, file);
    if (uploadError) {
      setBusy(null);
      setError(uploadError);
      return;
    }

    setBusy("Saving…");
    data.delete("file");
    data.set("storagePath", ticket.path);
    data.set("fileName", file.name);
    data.set("contentType", file.type || "");
    data.set("fileSize", String(file.size));

    const res = await uploadOwnDocumentAction({}, data);
    setBusy(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    toast(res.message || "Uploaded ✓");
    form.reset();
    setOpen(false);
  }

  return (
    <>
      {documents.length === 0 ? (
        <div className="empty-panel">
          <div className="empty-panel-title">No documents yet</div>
          <div className="empty-panel-body">
            {viewingAs
              ? "Nothing filed for this investor yet. Upload their DocuSign copies and wire instructions from the back office."
              : "Anything requiring your signature is sent through DocuSign. Once it's fully executed, the signed copy is filed here for you to view or download anytime."}
          </div>
        </div>
      ) : (
        <div className="doc-rows">
          {documents.map((d) => {
            const executed = fmtExecutedOn(d.executed_on);
            const mine = d.uploaded_by === "investor";
            const meta = [
              d.doc_type,
              mine ? "uploaded by you" : null,
              fmtFileSize(d.file_size),
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <div key={d.id} className="doc-row">
                <div className="doc-glyph">
                  <span className="doc-glyph-badge">{badgeFor(d.file_name)}</span>
                </div>
                <div className="doc-row-main">
                  <div className="doc-row-title">{d.title}</div>
                  <div className="doc-row-desc">{meta}</div>
                </div>
                <span className="doc-row-actions">
                  {executed && <span className="signed-chip">✓ Executed {executed}</span>}
                  {d.signed_at && (
                    <span className="signed-chip">✓ Signed {fmtDate(d.signed_at)}</span>
                  )}
                  {d.signature_requested && !d.signed_at && !viewingAs && (
                    <button
                      type="button"
                      className="sign-pill"
                      onClick={() => setSigningId(d.id)}
                    >
                      Review &amp; sign →
                    </button>
                  )}
                  {d.signature_requested && !d.signed_at && viewingAs && (
                    <span className="awaiting-chip">Awaiting signature</span>
                  )}
                  <a
                    className="signed-download"
                    href={`/api/investor-doc/${d.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View
                  </a>
                  <a className="signed-download" href={`/api/investor-doc/${d.id}?download=1`}>
                    Download →
                  </a>
                  {mine && !viewingAs && (
                    <button
                      type="button"
                      className="roster-btn roster-remove"
                      disabled={pending}
                      onClick={() => {
                        if (confirm(`Remove "${d.title}" from your folder?`)) {
                          startTransition(async () => {
                            const res = await deleteOwnDocumentAction(d.id);
                            toast(res.error || res.message || "Removed");
                          });
                        }
                      }}
                    >
                      ✕
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!viewingAs && (
        <div className="upload-cta">
          {open ? (
            <form ref={formRef} onSubmit={handleSubmit} className="dashed-panel">
              <div className="dashed-panel-title">Upload a document</div>
              <div className="form-helper">
                Send your banking details for ACH or wire setup. Only you and Kevin can see it.
              </div>
              <div className="split">
                <div className="field field-tight">
                  <label className="label label-sm">WHAT IS IT?</label>
                  <input
                    name="title"
                    className="input input-sm"
                    placeholder="e.g. Bank information for ACH"
                  />
                </div>
                <div className="field field-tight">
                  <label className="label label-sm">TYPE</label>
                  <input
                    name="docType"
                    className="input input-sm"
                    list="self-doc-types"
                    placeholder="Bank Information"
                  />
                  <datalist id="self-doc-types">
                    {INVESTOR_DOC_TYPE_SUGGESTIONS.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
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
                  {busy ?? "Upload"}
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
              + Upload a document
            </button>
          )}
        </div>
      )}

      {signing && !viewingAs && (
        <SignDocumentModal
          doc={signing}
          legalName={legalName}
          onClose={() => setSigningId(null)}
        />
      )}
    </>
  );
}
