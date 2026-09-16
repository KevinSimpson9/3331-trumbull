"use client";

import { useRef, useState, useTransition } from "react";
import {
  addProjectDocumentAction,
  createProjectUploadTicket,
  deleteProjectDocumentAction,
} from "@/app/actions/admin";
import { MAX_UPLOAD_BYTES } from "@/lib/investorDocs";
import { uploadToSignedUrl } from "@/lib/upload";
import { useToast } from "@/components/Toast";
import type { ProjectDocument } from "@/lib/types";

/** The shared library every investor sees. Managed here so correcting a
 *  document never means opening the Supabase dashboard. */
export default function ProjectLibraryCard({ documents }: { documents: ProjectDocument[] }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  /** Same two-phase upload as the executed-documents card: bytes direct to
   *  Supabase, metadata through the server action. */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    const hasFile = file instanceof File && file.size > 0;

    if (hasFile) {
      const upload = file as File;
      if (upload.size > MAX_UPLOAD_BYTES) {
        setError(`That file is larger than ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
        return;
      }
      setBusy("Uploading…");
      const ticket = await createProjectUploadTicket(upload.name, upload.size);
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
    }

    setBusy("Adding…");
    data.delete("file");
    const res = await addProjectDocumentAction({}, data);
    setBusy(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    toast(res.message || "Added ✓");
    form.reset();
    setOpen(false);
  }

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <div className="admin-card-title">Project document library</div>
        <button type="button" className="btn-gold btn-gold-sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "+ Add document"}
        </button>
      </div>
      <div className="form-helper" style={{ marginBottom: 4 }}>
        Shared with every signed-in investor. Replacing a document means adding the corrected
        file and removing the old one.
      </div>

      <div className="doc-rows">
        {documents.map((d) => (
          <div key={d.id} className="doc-row">
            <div className="doc-glyph">
              <span className="doc-glyph-badge">{d.badge}</span>
            </div>
            <div className="doc-row-main">
              <div className="doc-row-title">{d.title}</div>
              <div className="doc-row-desc">{d.description || d.href || (d.storage_path ? "Uploaded file" : "")}</div>
            </div>
            <span className="doc-row-actions">
              <a
                className="signed-download"
                href={d.href ?? `/api/doc/${d.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open
              </a>
              <button
                type="button"
                className="roster-btn roster-remove"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Remove "${d.title}" from the shared library?`)) {
                    startTransition(async () => {
                      const res = await deleteProjectDocumentAction(d.id);
                      toast(res.error || res.message || "Removed");
                    });
                  }
                }}
              >
                ✕
              </button>
            </span>
          </div>
        ))}
        {documents.length === 0 && (
          <div className="empty-panel">
            <div className="empty-panel-title">The library is empty</div>
            <div className="empty-panel-body">
              Investors see an empty shelf until you add something here.
            </div>
          </div>
        )}
      </div>

      {open && (
        <form ref={formRef} onSubmit={handleSubmit} className="dashed-panel">
          <div className="dashed-panel-title">Add a library document</div>
          <div className="split">
            <div className="field field-tight">
              <label className="label label-sm">TITLE</label>
              <input name="title" className="input input-sm" placeholder="e.g. Independent Appraisal" />
            </div>
            <div className="field field-tight">
              <label className="label label-sm">DESCRIPTION</label>
              <input
                name="description"
                className="input input-sm"
                placeholder="Certified appraisal · Q3 2026"
              />
            </div>
          </div>
          <div className="field field-tight">
            <label className="label label-sm">FILE (PDF, WORD, EXCEL OR IMAGE · MAX 25 MB)</label>
            <input
              name="file"
              type="file"
              className="input input-sm"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            />
          </div>
          <div className="field field-tight">
            <label className="label label-sm">…OR AN EXTERNAL LINK INSTEAD</label>
            <input name="href" className="input input-sm" placeholder="https://trumbullnorth.com" />
          </div>
          <div className="form-helper">Use a file or a link, not both.</div>
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
              {busy ?? "Add to library"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
